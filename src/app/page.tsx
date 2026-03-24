"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Flame, Headphones, Hourglass, Target } from "lucide-react";
import { DAILY_TARGET, JOURNEY_DAYS, LoopStep, SHLOKAS, TOTAL_SHLOKAS } from "@/lib/shlokas";

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
  contentMode: "sanskrit" | "transliteration" | "english";
};

const STORAGE_KEY = "gita-learning-state-v2";
const LOOP_STEPS: LoopStep[] = ["listen", "repeat", "understand", "recall"];

const defaultStepProgress = (): StepProgress => ({
  listen: false,
  repeat: false,
  understand: false,
  recall: false,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a: string, b: string) => {
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / oneDay);
  return Number.isNaN(diff) ? 0 : diff;
};

const fullDone = (step?: StepProgress) => Boolean(step?.listen && step.repeat && step.understand && step.recall);

export default function Home() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>({
    startedAt: todayIso(),
    lastActiveDate: todayIso(),
    activeMode: "normal",
    completed: {},
    recallWins: 0,
    recallAttempts: 0,
    activeIndex: 0,
    contentMode: "sanskrit",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        const gap = daysBetween(parsed.lastActiveDate, todayIso());
        setState({
          ...parsed,
          lastActiveDate: todayIso(),
          activeMode: gap >= 2 ? "lite" : parsed.activeMode,
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

  const completedCount = useMemo(
    () => SHLOKAS.filter((item) => fullDone(state.completed[item.id])).length,
    [state.completed],
  );

  const recallRate = state.recallAttempts ? Math.round((state.recallWins / state.recallAttempts) * 100) : 0;
  const dayNumber = Math.min(Math.ceil(JOURNEY_DAYS), Math.floor(completedCount / DAILY_TARGET) + 1);
  const streak = Math.max(1, daysBetween(state.startedAt, todayIso()) + 1);

  const pending = useMemo(() => SHLOKAS.filter((item) => !fullDone(state.completed[item.id])), [state.completed]);

  const planSize = state.activeMode === "lite" ? 1 : DAILY_TARGET;
  const todayPlan = pending.slice(0, planSize);

  const boundedIndex = Math.min(state.activeIndex, Math.max(0, todayPlan.length - 1));
  const active = todayPlan[boundedIndex];
  const activeProgress = active ? state.completed[active.id] ?? defaultStepProgress() : defaultStepProgress();

  const markStep = (id: string, step: LoopStep) => {
    setState((prev) => {
      const current = prev.completed[id] ?? defaultStepProgress();
      const wasRecall = current.recall;
      const updated = { ...current, [step]: !current[step] };
      return {
        ...prev,
        completed: { ...prev.completed, [id]: updated },
        recallAttempts: step === "recall" ? prev.recallAttempts + 1 : prev.recallAttempts,
        recallWins: step === "recall" && !wasRecall ? prev.recallWins + 1 : prev.recallWins,
      };
    });
  };

  const setMode = (mode: "normal" | "lite") => {
    setState((prev) => ({ ...prev, activeMode: mode, activeIndex: 0 }));
  };

  const speak = (text: string, slow: boolean) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text.replace(/\n/g, " "));
    utterance.rate = slow ? 0.72 : 1;
    utterance.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  if (!ready) return <main className="min-h-screen bg-[#f2e8d0]" />;

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,_#fff7df_0%,_#f4e9cb_45%,_#e8d9b4_100%)] px-2 py-2 text-[#2f2415] md:px-3 md:py-3">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-2">
        <header className="rounded-2xl border border-[#cdb58b] bg-[#fff7df]/90 p-2.5 shadow-[0_8px_20px_rgba(105,74,28,0.1)] md:p-3">
          <h1 className="font-serif text-xl leading-tight md:text-2xl">Gita Memorization Focus Cards</h1>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 md:grid-cols-4">
            <Metric icon={Target} label="Journey" value={`Day ${dayNumber}/${Math.ceil(JOURNEY_DAYS)}`} />
            <Metric icon={CheckCircle2} label="Mastered" value={`${completedCount}/${TOTAL_SHLOKAS}`} />
            <Metric icon={Flame} label="Streak" value={`${streak} days`} />
            <Metric icon={Hourglass} label="Recall" value={`${recallRate}%`} />
          </div>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-[#d4be94] bg-[#fbf3df] px-2.5 py-1.5">
          <div className="text-xs text-[#5d492b] md:text-sm">Mode controls your daily card count.</div>
          <div className="flex rounded-full border border-[#c7ad7d] bg-[#f7edd4] p-0.5">
            <button
              className={`rounded-full px-3 py-1 text-xs md:text-sm ${state.activeMode === "normal" ? "bg-[#8f6422] text-white" : "text-[#6a532f]"}`}
              onClick={() => setMode("normal")}
            >
              Normal (2)
            </button>
            <button
              className={`rounded-full px-3 py-1 text-xs md:text-sm ${state.activeMode === "lite" ? "bg-[#8f6422] text-white" : "text-[#6a532f]"}`}
              onClick={() => setMode("lite")}
            >
              Lite (1)
            </button>
          </div>
        </section>

        {todayPlan.length === 0 ? (
          <section className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-[#ccb385] bg-[#fff7df] p-10 text-center text-[#5e4928]">
            All selected shlokas completed. Use recall practice daily to retain fluency.
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {todayPlan.length > 1 ? (
              <section className="flex gap-1.5">
                {todayPlan.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setState((prev) => ({ ...prev, activeIndex: idx }))}
                    className={`rounded-full border px-3 py-1.5 text-xs md:text-sm ${idx === boundedIndex ? "border-[#8f6422] bg-[#8f6422] text-white" : "border-[#ccb385] bg-[#fbf3df] text-[#654f2e]"}`}
                  >
                    {item.reference}
                  </button>
                ))}
              </section>
            ) : null}

            {active ? (
              <article className="flex min-h-0 flex-1 flex-col rounded-[1.35rem] border border-[#b9995e] bg-gradient-to-b from-[#fffaf0] to-[#f7ebcf] p-3 shadow-[0_14px_30px_rgba(90,63,20,0.14)] md:p-4">
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8a6b3d]">{active.id}</p>
                    <h2 className="font-serif text-lg md:text-xl">Bhagavad Gita {active.reference}</h2>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="rounded-lg border border-[#b89965] bg-white px-3 py-1.5 text-xs" onClick={() => speak(active.transliteration, true)}>
                      <Headphones className="mr-1 inline h-3.5 w-3.5" /> Slow
                    </button>
                    <button className="rounded-lg border border-[#b89965] bg-white px-3 py-1.5 text-xs" onClick={() => speak(active.transliteration, false)}>
                      <Headphones className="mr-1 inline h-3.5 w-3.5" /> Normal
                    </button>
                  </div>
                </div>

                <section className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setState((prev) => ({ ...prev, contentMode: "sanskrit" }))}
                    className={`rounded-full border px-3 py-1 text-xs ${state.contentMode === "sanskrit" ? "border-[#8f6422] bg-[#8f6422] text-white" : "border-[#ccb385] bg-white text-[#654f2e]"}`}
                  >
                    Sanskrit
                  </button>
                  <button
                    onClick={() => setState((prev) => ({ ...prev, contentMode: "transliteration" }))}
                    className={`rounded-full border px-3 py-1 text-xs ${state.contentMode === "transliteration" ? "border-[#8f6422] bg-[#8f6422] text-white" : "border-[#ccb385] bg-white text-[#654f2e]"}`}
                  >
                    Transliteration
                  </button>
                  <button
                    onClick={() => setState((prev) => ({ ...prev, contentMode: "english" }))}
                    className={`rounded-full border px-3 py-1 text-xs ${state.contentMode === "english" ? "border-[#8f6422] bg-[#8f6422] text-white" : "border-[#ccb385] bg-white text-[#654f2e]"}`}
                  >
                    English
                  </button>
                </section>

                <section className="mt-1.5 min-h-0 rounded-xl border border-[#d7c296] bg-[#fffdf8] p-2.5 md:p-3">
                  {state.contentMode === "sanskrit" ? (
                    <p className="line-clamp-8 whitespace-pre-line font-serif text-base leading-[1.5] text-[#2f2415] md:text-xl">{active.sanskrit}</p>
                  ) : null}
                  {state.contentMode === "transliteration" ? (
                    <p className="line-clamp-8 whitespace-pre-line text-xs leading-6 text-[#4e3d21] md:text-sm">{active.transliteration}</p>
                  ) : null}
                  {state.contentMode === "english" ? (
                    <>
                      <p className="line-clamp-8 text-xs leading-6 text-[#4e3d21] md:text-sm">{active.english}</p>
                      <p className="mt-1 text-[11px] text-[#7a6440]">Translation: {active.translationAuthor}</p>
                    </>
                  ) : null}
                </section>

                <section className="mt-1.5 rounded-xl border border-[#d4bc8f] bg-[#fdf4de] p-2.5">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#8b7045]">Practice Loop</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 md:grid-cols-4">
                    {LOOP_STEPS.map((step) => (
                      <button
                        key={`${active.id}-${step}`}
                        onClick={() => markStep(active.id, step)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs capitalize md:text-sm ${
                          activeProgress[step]
                            ? "border-[#4f7c39] bg-[#e5f2dc] text-[#224318]"
                            : "border-[#ccb385] bg-white text-[#5e4a2b]"
                        }`}
                      >
                        {step}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-[#5d492a]">{active.reflectionPrompt}</p>
                </section>
              </article>
            ) : null}
          </div>
        )}
      </div>
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
