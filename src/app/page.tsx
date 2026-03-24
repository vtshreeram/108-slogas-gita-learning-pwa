"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Flame, Headphones, Hourglass, Target } from "lucide-react";
import { DAILY_TARGET, JOURNEY_DAYS, LoopStep, SHLOKAS, TOTAL_SHLOKAS } from "@/lib/shlokas";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StepProgress = Record<LoopStep, boolean>;
type ItemProgress = Record<string, StepProgress>;

type AppState = {
  startedAt: string;
  lastActiveDate: string;
  activeMode: "normal" | "lite";
  completed: ItemProgress;
  recallWins: number;
  recallAttempts: number;
  activeIndex: number;
  contentMode: "transliteration" | "english" | "sanskrit";
  expandedText: boolean;
};

const STORAGE_KEY = "gita-learning-state-v3";
const LOOP_STEPS: LoopStep[] = ["listen", "repeat", "understand", "recall"];

const defaultStepProgress = (): StepProgress => ({
  listen: false,
  repeat: false,
  understand: false,
  recall: false,
});

const todayIso = () => new Date().toISOString().slice(0, 10);
const fullDone = (step?: StepProgress) => Boolean(step?.listen && step.repeat && step.understand && step.recall);
const daysBetween = (a: string, b: string) => {
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / oneDay);
  return Number.isNaN(diff) ? 0 : diff;
};

export default function Home() {
  const [ready, setReady] = useState(false);
  const [confirmLearnedOpen, setConfirmLearnedOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  const [state, setState] = useState<AppState>({
    startedAt: todayIso(),
    lastActiveDate: todayIso(),
    activeMode: "normal",
    completed: {},
    recallWins: 0,
    recallAttempts: 0,
    activeIndex: 0,
    contentMode: "transliteration",
    expandedText: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        const safeIndex = Math.max(0, Math.min(SHLOKAS.length - 1, Number(parsed.activeIndex ?? 0) || 0));
        setState({
          startedAt: parsed.startedAt ?? todayIso(),
          lastActiveDate: todayIso(),
          activeMode: parsed.activeMode === "lite" ? "lite" : "normal",
          completed: parsed.completed ?? {},
          recallWins: Number(parsed.recallWins ?? 0) || 0,
          recallAttempts: Number(parsed.recallAttempts ?? 0) || 0,
          activeIndex: safeIndex,
          contentMode: parsed.contentMode ?? "transliteration",
          expandedText: Boolean(parsed.expandedText),
        });
      }
    } catch {
      // defaults
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1), expandedText: false }));
      if (event.key === "ArrowLeft") setState((prev) => ({ ...prev, activeIndex: Math.max(0, prev.activeIndex - 1), expandedText: false }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const completedCount = useMemo(() => SHLOKAS.filter((item) => fullDone(state.completed[item.id])).length, [state.completed]);
  const completedShlokas = useMemo(() => SHLOKAS.filter((item) => fullDone(state.completed[item.id])), [state.completed]);
  const recallRate = state.recallAttempts ? Math.round((state.recallWins / state.recallAttempts) * 100) : 0;
  const streak = Math.max(1, daysBetween(state.startedAt, todayIso()) + 1);
  const progressPct = Math.round((completedCount / TOTAL_SHLOKAS) * 100);

  const safeActiveIndex = Math.max(0, Math.min(SHLOKAS.length - 1, state.activeIndex));
  const active = SHLOKAS[safeActiveIndex];
  const activeProgress = active ? state.completed[active.id] ?? defaultStepProgress() : defaultStepProgress();
  const activeGlobalIndex = safeActiveIndex + 1;
  const isFirst = activeGlobalIndex === 1;
  const isLast = activeGlobalIndex === TOTAL_SHLOKAS;

  const dailyGoal = state.activeMode === "lite" ? 1 : DAILY_TARGET;
  const firstPending = Math.max(0, SHLOKAS.findIndex((item) => !fullDone(state.completed[item.id])));
  const todayFocus = SHLOKAS.slice(firstPending, Math.min(firstPending + dailyGoal, SHLOKAS.length));

  const markStep = (id: string, step: LoopStep) => {
    setState((prev) => {
      const current = prev.completed[id] ?? defaultStepProgress();
      const updated = { ...current, [step]: !current[step] };
      return {
        ...prev,
        completed: { ...prev.completed, [id]: updated },
        recallAttempts: step === "recall" ? prev.recallAttempts + 1 : prev.recallAttempts,
        recallWins: step === "recall" && !current.recall ? prev.recallWins + 1 : prev.recallWins,
      };
    });
  };

  const markAsLearned = (id: string) => {
    setState((prev) => ({
      ...prev,
      completed: {
        ...prev.completed,
        [id]: { listen: true, repeat: true, understand: true, recall: true },
      },
      activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1),
    }));
  };

  const undoLearnedForActive = () => {
    setState((prev) => {
      const completed = { ...prev.completed };
      delete completed[active.id];
      return { ...prev, completed };
    });
  };

  const speak = (text: string, slow: boolean) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text.replace(/\n/g, " "));
    u.rate = slow ? 0.72 : 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };

  if (!ready || !active) return <main className="min-h-screen bg-[#f2e8d0]" />;

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,_#fff7df_0%,_#f4e9cb_45%,_#e8d9b4_100%)] px-2 py-2 text-[#2f2415] md:px-3 md:py-3">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-2">
        <header className="rounded-2xl border border-[#cdb58b] bg-[#fff7df]/90 p-2.5 shadow-[0_8px_20px_rgba(105,74,28,0.1)] md:p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-serif text-xl leading-tight md:text-2xl">Gita Memorization Focus Cards</h1>
            <button onClick={() => setCompletedOpen(true)} className="rounded-md border border-[#c7ad7d] bg-white px-2 py-1 text-[11px] text-[#5d492b]">
              Completed ({completedCount})
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 md:grid-cols-4">
            <Metric icon={Target} label="Journey" value={`Day ${Math.min(Math.ceil(JOURNEY_DAYS), Math.floor(completedCount / DAILY_TARGET) + 1)}/${Math.ceil(JOURNEY_DAYS)}`} />
            <Metric icon={CheckCircle2} label="Mastered" value={`${completedCount}/${TOTAL_SHLOKAS}`} />
            <Metric icon={Flame} label="Streak" value={`${streak}d`} />
            <Metric icon={Hourglass} label="Recall" value={`${recallRate}%`} />
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[#ead9b5]">
            <div className="h-full rounded-full bg-[#8f6422]" style={{ width: `${progressPct}%` }} />
          </div>
        </header>

        <section className="flex items-center justify-between rounded-xl border border-[#d4be94] bg-[#fbf3df] px-2.5 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#6a5432]">Today:</span>
            {todayFocus.map((item) => (
              <button
                key={item.id}
                onClick={() => setState((prev) => ({ ...prev, activeIndex: SHLOKAS.findIndex((s) => s.id === item.id), expandedText: false }))}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  fullDone(state.completed[item.id])
                    ? "border-[#73a25f] bg-[#e8f5df] text-[#2c5d1f]"
                    : active.id === item.id
                      ? "border-[#8f6422] bg-[#8f6422] text-white"
                      : "border-[#ccb385] bg-white text-[#654f2e]"
                }`}
              >
                {item.reference}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#5d492b]">Mode</span>
            <div className="flex rounded-full border border-[#c7ad7d] bg-[#f7edd4] p-0.5">
              <button className={`rounded-full px-2.5 py-1 text-[11px] ${state.activeMode === "normal" ? "bg-[#8f6422] text-white" : "text-[#6a532f]"}`} onClick={() => setState((prev) => ({ ...prev, activeMode: "normal" }))}>
                Normal
              </button>
              <button className={`rounded-full px-2.5 py-1 text-[11px] ${state.activeMode === "lite" ? "bg-[#8f6422] text-white" : "text-[#6a532f]"}`} onClick={() => setState((prev) => ({ ...prev, activeMode: "lite" }))}>
                Lite
              </button>
            </div>
          </div>
        </section>

        <article className="flex min-h-0 flex-1 flex-col rounded-[1.35rem] border border-[#b9995e] bg-gradient-to-b from-[#fffaf0] to-[#f7ebcf] p-3 shadow-[0_14px_30px_rgba(90,63,20,0.14)] md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#8a6b3d]">{active.id}</p>
              <h2 className="font-serif text-lg md:text-xl">
                Bhagavad Gita {active.reference} {fullDone(activeProgress) ? <CheckCircle2 className="mb-0.5 inline h-4 w-4 text-[#2e6b1f]" /> : null}
              </h2>
              <p className="text-[11px] text-[#6a5432]">Verse {activeGlobalIndex}/{TOTAL_SHLOKAS}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => setState((prev) => ({ ...prev, activeIndex: Math.max(0, prev.activeIndex - 1), expandedText: false }))} disabled={isFirst} className="rounded-md border border-[#ccb385] bg-white px-2 py-1 text-xs disabled:opacity-50">
                <ChevronLeft className="mr-0.5 inline h-3.5 w-3.5" /> Back
              </button>
              <button onClick={() => setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1), expandedText: false }))} disabled={isLast} className="rounded-md border border-[#ccb385] bg-white px-2 py-1 text-xs disabled:opacity-50">
                Next <ChevronRight className="ml-0.5 inline h-3.5 w-3.5" />
              </button>
              <button className="rounded-lg border border-[#b89965] bg-white px-3 py-1.5 text-xs" onClick={() => speak(active.transliteration, true)}>
                <Headphones className="mr-1 inline h-3.5 w-3.5" /> Slow
              </button>
              <button className="rounded-lg border border-[#b89965] bg-white px-3 py-1.5 text-xs" onClick={() => speak(active.transliteration, false)}>
                <Headphones className="mr-1 inline h-3.5 w-3.5" /> Normal
              </button>
              <button onClick={() => setConfirmLearnedOpen(true)} className="rounded-lg border border-[#8f6422] bg-[#8f6422] px-3 py-1.5 text-xs font-semibold text-white">
                Mark Learned
              </button>
            </div>
          </div>
          <section className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              {(["transliteration", "english", "sanskrit"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setState((prev) => ({ ...prev, contentMode: mode }))}
                  className={`rounded-full border px-3 py-1 text-xs ${state.contentMode === mode ? "border-[#8f6422] bg-[#8f6422] text-white" : "border-[#ccb385] bg-white text-[#654f2e]"}`}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
              <button onClick={() => setState((prev) => ({ ...prev, expandedText: !prev.expandedText }))} className="rounded-full border border-[#ccb385] bg-white px-3 py-1 text-xs text-[#654f2e]">
                {state.expandedText ? "Collapse" : "Expand"}
              </button>
            </div>
            {fullDone(activeProgress) ? (
              <button onClick={undoLearnedForActive} className="rounded-lg border border-[#73a25f] bg-[#e8f5df] px-3 py-1.5 text-xs font-semibold text-[#2c5d1f]">
                Undo Learned
              </button>
            ) : (
              <span />
            )}
          </section>

          <section className="mt-1.5 min-h-0 rounded-xl border border-[#d7c296] bg-[#fffdf8] p-2.5 md:p-3">
            {state.contentMode === "sanskrit" ? (
              <p className={`${state.expandedText ? "" : "line-clamp-8"} whitespace-pre-line font-serif text-base leading-[1.35] text-[#2f2415] md:text-xl`}>
                {active.sanskrit.replace(/\n{2,}/g, "\n")}
              </p>
            ) : null}
            {state.contentMode === "transliteration" ? (
              <p className={`${state.expandedText ? "" : "line-clamp-8"} whitespace-pre-line text-xs leading-6 text-[#4e3d21] md:text-sm`}>{active.transliteration}</p>
            ) : null}
            {state.contentMode === "english" ? (
              <>
                <p className={`${state.expandedText ? "" : "line-clamp-8"} text-xs leading-6 text-[#4e3d21] md:text-sm`}>{active.english}</p>
                <p className="mt-1 text-[11px] text-[#7a6440]">Translation: {active.translationAuthor}</p>
              </>
            ) : null}
          </section>

          <section className="mt-1.5 rounded-xl border border-[#d4bc8f] bg-[#fdf4de] p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.12em] text-[#8b7045]">Practice Loop</p>
              <span className="text-[11px] text-[#7b6642]">Listen → Repeat → Understand → Recall</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 md:grid-cols-4">
              {LOOP_STEPS.map((step) => (
                <button
                  key={`${active.id}-${step}`}
                  onClick={() => markStep(active.id, step)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs capitalize md:text-sm ${
                    activeProgress[step] ? "border-[#4f7c39] bg-[#e5f2dc] text-[#224318]" : "border-[#ccb385] bg-white text-[#5e4a2b]"
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>
          </section>
        </article>
      </div>

      <Dialog open={confirmLearnedOpen} onOpenChange={setConfirmLearnedOpen}>
        <DialogContent className="max-w-sm border-[#ccb385] !bg-white p-4 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Mark This Shloka as Learned?</DialogTitle>
            <DialogDescription className="text-xs text-[#5f4a2b]">This will mark all 4 learning steps as complete for this shloka.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <button onClick={() => setConfirmLearnedOpen(false)} className="rounded-md border border-[#ccb385] bg-white px-3 py-1.5 text-xs text-[#5c482a]">
              Cancel
            </button>
            <button
              onClick={() => {
                markAsLearned(active.id);
                setConfirmLearnedOpen(false);
              }}
              className="rounded-md border border-[#8f6422] bg-[#8f6422] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Yes, Mark Learned
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completedOpen} onOpenChange={setCompletedOpen}>
        <DialogContent className="max-w-lg border-[#ccb385] !bg-white p-4 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Completed Shlokas</DialogTitle>
            <DialogDescription className="text-xs text-[#5f4a2b]">{completedShlokas.length} learned shlokas</DialogDescription>
          </DialogHeader>
          {completedShlokas.length === 0 ? (
            <p className="text-xs text-[#6b5532]">No completed shlokas yet.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-[#e1d0ae] bg-[#fffaf0] p-2">
              <div className="flex flex-wrap gap-1.5">
                {completedShlokas.map((item) => {
                  const idx = SHLOKAS.findIndex((s) => s.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCompletedOpen(false);
                        setState((prev) => ({ ...prev, activeIndex: Math.max(0, idx), expandedText: false }));
                      }}
                      className="rounded-full border border-[#9fc48f] bg-[#edf8e7] px-2 py-1 text-[11px] text-[#315126]"
                    >
                      {item.reference}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

type MetricProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="rounded-lg border border-[#d3bc91] bg-[#fffdf8] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[#886d41]">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-[#392b16] md:text-base">
        <Icon className="h-3.5 w-3.5" />
        {value}
      </p>
    </div>
  );
}
