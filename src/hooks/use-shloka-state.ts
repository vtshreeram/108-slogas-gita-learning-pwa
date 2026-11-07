import { useState, useEffect, useMemo, useCallback } from "react";
import { LoopStep } from "@/lib/shlokas";
import { AppState } from "@/lib/constants";
import * as progress from "@/lib/learning-progress";
import { todayIso } from "@/lib/constants";
import { localStorageAdapter, loadState, saveState, initialState, deriveStats, CHAPTER_LIST } from "@/lib/learning-progress";

/** Thin React wrapper over the Learning progress module. */
export function useShlokaState() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(() => initialState());

  useEffect(() => {
    try {
      const result = loadState(localStorageAdapter);
      if (result.status === "invalid") console.warn("Failed to load saved state (stashed, not overwritten):", result.error);
      setState(result.state);
    } catch (e) {
      console.warn("Failed to load saved state:", e);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { saveState(localStorageAdapter, state); } catch (e) { console.warn("Failed to save state:", e); }
  }, [ready, state]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  const markStep = useCallback((id: string, step: LoopStep) => update((s) => progress.markStep(s, id, step)), [update]);
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
    markStep, markAsLearned, undoLearnedForActive,
    goTo, goToShloka, next, prev, setContentMode, setActiveMode,
    ...stats,
    // not memoized: must follow the clock if the app stays open past midnight
    practicedToday: state.lastPracticeDate === todayIso(),
    chapterList: CHAPTER_LIST,
  };
}
