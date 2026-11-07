import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LoopStep } from "@/lib/shlokas";
import { AppState, todayIso } from "@/lib/constants";
import * as progress from "@/lib/learning-progress";
import { saveState, initialState, deriveStats, CHAPTER_LIST } from "@/lib/learning-progress";
import { localKV, loadForUser, progressStoreFor, ProgressStore, SyncMeta } from "@/lib/progress-store";
import { createProgressSync } from "@/lib/progress-sync";
import { createFirestoreRemote } from "@/lib/firestore-remote";

/**
 * Thin React wrapper over the Learning progress module.
 * Progress is stored per user id; with cloud sync enabled it also follows the account.
 */
export function useShlokaState(uid: string | null) {
  const [state, setState] = useState<AppState>(() => initialState());
  // Which uid `state` was loaded for. Saves only happen when it matches the current uid,
  // so one account's progress can never be written under another's key.
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const stateRef = useRef(state);
  const metaRef = useRef<SyncMeta>({ updatedAt: 0, synced: false });
  const storeRef = useRef<ProgressStore | null>(null);
  const syncRef = useRef<ReturnType<typeof createProgressSync> | null>(null);

  const ready = uid !== null && loadedUid === uid;

  useEffect(() => {
    syncRef.current = null;
    storeRef.current = null;
    if (!uid) { setLoadedUid(null); return; }

    let cleanup: (() => void) | undefined;
    try {
      const store = progressStoreFor(localKV, uid);
      const result = loadForUser(localKV, uid);
      if (result.status === "invalid") console.warn("Failed to load saved state (stashed, not overwritten):", result.error);
      storeRef.current = store;
      metaRef.current = store.readMeta();
      stateRef.current = result.state;
      setState(result.state);

      const remote = createFirestoreRemote();
      if (remote) {
        const sync = createProgressSync({
          uid,
          remote,
          getLocal: () => ({ state: stateRef.current, meta: metaRef.current }),
          apply: (next, meta) => { stateRef.current = next; metaRef.current = meta; store.writeMeta(meta); setState(next); },
          setMeta: (meta) => { metaRef.current = meta; store.writeMeta(meta); },
        });
        syncRef.current = sync;
        const onOnline = () => { void sync.syncNow(); };
        window.addEventListener("online", onOnline);
        void sync.syncNow();
        cleanup = () => { window.removeEventListener("online", onOnline); sync.dispose(); };
      }
    } catch (e) {
      console.warn("Failed to load saved state:", e);
    } finally {
      setLoadedUid(uid);
    }
    return () => { cleanup?.(); };
  }, [uid]);

  useEffect(() => {
    if (!uid || loadedUid !== uid || !storeRef.current) return;
    try { saveState(storeRef.current, state); } catch (e) { console.warn("Failed to save state:", e); }
  }, [uid, loadedUid, state]);

  /** Every user action goes through here: this is the only place `updatedAt` advances. */
  const update = useCallback((fn: (s: AppState) => AppState) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    const meta: SyncMeta = { updatedAt: Math.max(Date.now(), metaRef.current.updatedAt + 1), synced: false };
    metaRef.current = meta;
    try { storeRef.current?.writeMeta(meta); } catch { /* best effort */ }
    setState(next);
    syncRef.current?.markDirty();
  }, []);

  const markStep = useCallback((id: string, step: LoopStep) => update((s) => progress.markStep(s, id, step)), [update]);
  const recallMissed = useCallback(() => update(progress.recallMissed), [update]);
  const markAsLearned = useCallback((id: string) => update((s) => progress.markAsLearned(s, id)), [update]);
  const undoLearnedForActive = useCallback((id: string) => update((s) => progress.undoLearned(s, id)), [update]);
  const goTo = useCallback((index: number) => update((s) => progress.goTo(s, index)), [update]);
  const goToShloka = useCallback((id: string) => update((s) => progress.goToShloka(s, id)), [update]);
  const next = useCallback(() => update(progress.goNext), [update]);
  const prev = useCallback(() => update(progress.goPrev), [update]);
  const setContentMode = useCallback((m: AppState["contentMode"]) => update((s) => progress.setContentMode(s, m)), [update]);
  const setActiveMode = useCallback((m: AppState["activeMode"]) => update((s) => progress.setActiveMode(s, m)), [update]);

  const stats = useMemo(() => deriveStats(state), [state]);

  return {
    ready, state,
    markStep, recallMissed, markAsLearned, undoLearnedForActive,
    goTo, goToShloka, next, prev, setContentMode, setActiveMode,
    ...stats,
    // not memoized: must follow the clock if the app stays open past midnight
    practicedToday: state.lastPracticeDate === todayIso(),
    chapterList: CHAPTER_LIST,
  };
}
