import { useState, useEffect, useMemo } from "react";
import { SHLOKAS, TOTAL_SHLOKAS, DAILY_TARGET, LoopStep } from "@/lib/shlokas";
import { AppState, STORAGE_KEY, SCHEMA_VERSION, defaultStepProgress, todayIso, fullDone } from "@/lib/constants";

export function useShlokaState() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>({
    schemaVersion: SCHEMA_VERSION,
    startedAt: todayIso(),
    lastActiveDate: todayIso(),
    lastPracticeDate: "",
    streakCount: 0,
    activeMode: "normal",
    completed: {},
    recallWins: 0,
    recallAttempts: 0,
    activeIndex: 0,
    contentMode: "transliteration",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (Number(parsed.schemaVersion) !== SCHEMA_VERSION) throw new Error("schema mismatch");
        const safeIndex = Math.max(0, Math.min(SHLOKAS.length - 1, Number(parsed.activeIndex ?? 0) || 0));
        setState({
          schemaVersion: SCHEMA_VERSION,
          startedAt: parsed.startedAt ?? todayIso(),
          lastActiveDate: todayIso(),
          lastPracticeDate: parsed.lastPracticeDate ?? "",
          streakCount: Number(parsed.streakCount ?? 0) || 0,
          activeMode: parsed.activeMode === "lite" ? "lite" : "normal",
          completed: parsed.completed ?? {},
          recallWins: Number(parsed.recallWins ?? 0) || 0,
          recallAttempts: Number(parsed.recallAttempts ?? 0) || 0,
          activeIndex: safeIndex,
          contentMode: parsed.contentMode ?? "transliteration",
        });
      }
    } catch {} finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const markStep = (id: string, step: LoopStep) => {
    setState((prev) => {
      const current = prev.completed[id] ?? defaultStepProgress();
      const isMarkingTrue = !current[step];
      const updated = { ...current, [step]: isMarkingTrue };
      let { lastPracticeDate, streakCount } = prev;
      if (step === "recall" && isMarkingTrue) {
        const today = todayIso();
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (lastPracticeDate === today) {} else if (lastPracticeDate === yesterday) { streakCount += 1; } else { streakCount = 1; }
        lastPracticeDate = today;
      }
      return {
        ...prev,
        completed: { ...prev.completed, [id]: updated },
        recallAttempts: step === "recall" && isMarkingTrue ? prev.recallAttempts + 1 : prev.recallAttempts,
        recallWins: step === "recall" && isMarkingTrue ? prev.recallWins + 1 : prev.recallWins,
        lastPracticeDate,
        streakCount,
      };
    });
  };

  const markAsLearned = (id: string) => {
    setState((prev) => ({
      ...prev,
      completed: { ...prev.completed, [id]: { listen: true, repeat: true, understand: true, recall: true } },
      activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1),
    }));
  };

  const undoLearnedForActive = (id: string) => {
    setState((prev) => {
      const completed = { ...prev.completed };
      delete completed[id];
      return { ...prev, completed };
    });
  };

  const completedCount = useMemo(() => SHLOKAS.filter((item) => fullDone(state.completed[item.id])).length, [state.completed]);
  const completedShlokas = useMemo(() => SHLOKAS.filter((item) => fullDone(state.completed[item.id])), [state.completed]);
  const streak = state.streakCount;
  const progressPct = Math.round((completedCount / TOTAL_SHLOKAS) * 100);

  const safeActiveIndex = Math.max(0, Math.min(SHLOKAS.length - 1, state.activeIndex));
  const active = SHLOKAS[safeActiveIndex];
  const activeProgress = active ? state.completed[active.id] ?? defaultStepProgress() : defaultStepProgress();
  const activeGlobalIndex = safeActiveIndex + 1;
  const isFirst = activeGlobalIndex === 1;
  const isLast = activeGlobalIndex === TOTAL_SHLOKAS;
  const isMastered = fullDone(activeProgress);
  const dailyGoal = state.activeMode === "lite" ? 1 : DAILY_TARGET;
  const firstPending = Math.max(0, SHLOKAS.findIndex((item) => !fullDone(state.completed[item.id])));
  const chapterList = useMemo(() => [...new Set(SHLOKAS.map((s) => s.chapter))].sort((a, b) => a - b), []);

  return {
    ready, state, setState,
    markStep, markAsLearned, undoLearnedForActive,
    completedCount, completedShlokas, streak, progressPct,
    active, safeActiveIndex, activeProgress, activeGlobalIndex,
    isFirst, isLast, isMastered, dailyGoal, firstPending, chapterList
  };
}
