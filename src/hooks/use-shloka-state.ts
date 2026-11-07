import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LoopStep } from "@/lib/shlokas";
import { AppState, RecallRating, todayIso } from "@/lib/constants";
import * as progress from "@/lib/learning-progress";
import { saveState, initialState, deriveStats, CHAPTER_LIST } from "@/lib/learning-progress";
import { localKV, loadForUser, progressStoreFor, touchMeta, ProgressStore, SyncMeta } from "@/lib/progress-store";
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
  const [today, setToday] = useState(todayIso);
  const [syncStatus, setSyncStatus] = useState<"local" | "pending" | "syncing" | "synced" | "error">("local");
  const [storageError, setStorageError] = useState(false);
  const [online, setOnline] = useState(true);
  const stateRef = useRef(state);
  const metaRef = useRef<SyncMeta>({ updatedAt: 0, linked: false });
  const storeRef = useRef<ProgressStore | null>(null);
  const syncRef = useRef<ReturnType<typeof createProgressSync> | null>(null);

  const ready = uid !== null && loadedUid === uid;

  useEffect(() => {
    const refresh = () => { setToday(todayIso()); setOnline(navigator.onLine); };
    refresh();
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); };
  }, []);

  useEffect(() => {
    syncRef.current = null;
    storeRef.current = null;
    setSyncStatus("local");
    setStorageError(false);
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
          onStatus: setSyncStatus,
        });
        syncRef.current = sync;
        const onOnline = () => { void sync.syncNow(); };
        window.addEventListener("online", onOnline);
        void sync.syncNow();
        cleanup = () => { window.removeEventListener("online", onOnline); sync.dispose(); };
      }
    } catch (e) {
      setStorageError(true);
      console.warn("Failed to load saved state:", e);
    } finally {
      setLoadedUid(uid);
    }
    return () => { cleanup?.(); };
  }, [uid]);

  useEffect(() => {
    if (!uid || loadedUid !== uid || !storeRef.current) return;
    try { saveState(storeRef.current, state); setStorageError(false); } catch (e) { setStorageError(true); console.warn("Failed to save state:", e); }
  }, [uid, loadedUid, state]);

  /**
   * Every user action goes through here: this is the only place `updatedAt` advances.
   * `quiet` edits (browsing: position, content tab) are saved locally but neither bump
   * `updatedAt` nor trigger a push, so merely looking around can never beat newer progress
   * from another device; they travel with the next real edit.
   */
  const update = useCallback((fn: (s: AppState) => AppState, opts?: { quiet?: boolean }) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    if (!opts?.quiet) {
      const meta = touchMeta(metaRef.current, Date.now());
      metaRef.current = meta;
      try { storeRef.current?.writeMeta(meta); } catch { /* best effort */ }
      syncRef.current?.markDirty();
    }
    setState(next);
  }, []);

  const markStep = useCallback((id: string, step: LoopStep) => update((s) => progress.markStep(s, id, step)), [update]);
  const recallMissed = useCallback(() => update(progress.recallMissed), [update]);
  const completeRecall = useCallback((id: string, rating: RecallRating) => update((s) => progress.completeLearningRecall(s, id, rating)), [update]);
  const markAsLearned = useCallback((id: string) => update((s) => progress.markAsLearned(s, id)), [update]);
  const undoLearnedForActive = useCallback((id: string) => update((s) => progress.undoLearned(s, id)), [update]);
  const goTo = useCallback((index: number) => update((s) => progress.goTo(s, index), { quiet: true }), [update]);
  const goToShloka = useCallback((id: string) => update((s) => progress.goToShloka(s, id), { quiet: true }), [update]);
  const next = useCallback(() => update(progress.goNext, { quiet: true }), [update]);
  const prev = useCallback(() => update(progress.goPrev, { quiet: true }), [update]);
  const setContentMode = useCallback((m: AppState["contentMode"]) => update((s) => progress.setContentMode(s, m), { quiet: true }), [update]);
  const setActiveMode = useCallback((m: AppState["activeMode"]) => update((s) => progress.setActiveMode(s, m)), [update]);
  const rateRecall = useCallback((id: string, rating: RecallRating) => update((s) => progress.rateRecall(s, id, rating)), [update]);
  const retrySave = useCallback(() => {
    try {
      if (!storeRef.current) return;
      saveState(storeRef.current, stateRef.current);
      setStorageError(false);
      void syncRef.current?.syncNow();
    } catch { setStorageError(true); }
  }, []);

  const stats = useMemo(() => deriveStats(state, today), [state, today]);

  return {
    ready, state, syncStatus, storageError, online, retrySave, rateRecall, completeRecall,
    markStep, recallMissed, markAsLearned, undoLearnedForActive,
    goTo, goToShloka, next, prev, setContentMode, setActiveMode,
    ...stats,
    // not memoized: must follow the clock if the app stays open past midnight
    practicedToday: state.lastPracticeDate === todayIso(),
    chapterList: CHAPTER_LIST,
  };
}
