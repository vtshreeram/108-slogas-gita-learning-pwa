"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Flame, Pause, Play, Square } from "lucide-react";
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
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [audioState, setAudioState] = useState<"idle" | "playing" | "paused" | "unavailable">("idle");
  const [audioLoop, setAudioLoop] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [jumpRef, setJumpRef] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
  const audioSrc = `/audio/${active.reference}.mp3`;

  const dailyGoal = state.activeMode === "lite" ? 1 : DAILY_TARGET;
  const firstPending = Math.max(0, SHLOKAS.findIndex((item) => !fullDone(state.completed[item.id])));
  const todayFocus = SHLOKAS.slice(firstPending, Math.min(firstPending + dailyGoal, SHLOKAS.length));
  const chapterList = useMemo(() => [...new Set(SHLOKAS.map((s) => s.chapter))].sort((a, b) => a - b), []);

  const jumpToReference = (reference: string) => {
    const normalized = reference.trim();
    const idx = SHLOKAS.findIndex((s) => s.reference === normalized);
    if (idx >= 0) {
      setState((prev) => ({ ...prev, activeIndex: idx, expandedText: false }));
      return true;
    }
    return false;
  };

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

  const playAudio = async () => {
    if (!audioRef.current || !audioAvailable) return;
    try {
      await audioRef.current.play();
      setAudioState("playing");
    } catch {
      setAudioAvailable(false);
      setAudioState("unavailable");
    }
  };

  const pauseAudio = () => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.pause();
    setAudioState("paused");
  };

  const stopAudio = () => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setAudioState("idle");
  };

  const togglePlayPause = async () => {
    if (!audioRef.current || !audioAvailable) return;
    if (audioState === "playing") {
      pauseAudio();
      return;
    }
    await playAudio();
  };

  const seekAudio = (nextTime: number) => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.currentTime = nextTime;
    setAudioCurrentTime(nextTime);
  };

  const formatTime = (secs: number) => {
    const total = Math.max(0, Math.floor(secs));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setAudioAvailable(true);
    setAudioCurrentTime(0);
    setAudioDuration(0);

    if (pendingAutoPlay) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAudioState("playing");
          })
          .catch(() => {
            setAudioState("unavailable");
            setAudioAvailable(false);
          })
          .finally(() => {
            setPendingAutoPlay(false);
          });
      }
    } else {
      setAudioState("idle");
    }
  }, [active.reference, pendingAutoPlay]);

  if (!ready || !active) return <main className="min-h-screen bg-[#f2e8d0]" />;

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_20%_10%,_#fff7df_0%,_#f4e9cb_45%,_#e8d9b4_100%)] px-2 py-2 pb-36 text-[#2f2415] md:px-3 md:py-3 md:pb-3">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <header className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <div>
              <h1 className="font-serif text-2xl font-bold text-[#4a3615]">Bhagavad Gita</h1>
              <p className="text-[10px] font-medium tracking-[0.2em] text-[#8a6b3d] uppercase">Daily Practice</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-[#fcebc4] border border-[#f0d498] px-2.5 py-1 text-xs font-semibold text-[#8f6422] shadow-sm">
                <Flame className="h-3.5 w-3.5" />
                {streak}
              </div>
              <button onClick={() => setCompletedOpen(true)} className="flex items-center gap-1 rounded-full bg-[#e8f5df] border border-[#c1e0b0] px-2.5 py-1 text-xs font-semibold text-[#2c5d1f] shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {completedCount}
              </button>
            </div>
          </div>
          

        </header>

        <article className="relative flex min-h-[420px] flex-col rounded-[2rem] border border-[#cbb389] bg-gradient-to-br from-[#fffdf8] to-[#f8ead0] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#eee0c3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6c532d]">C:{active.chapter} S:{active.verse}</span>
              {fullDone(activeProgress) && <span className="flex items-center gap-1 text-[10px] font-bold text-[#356d25] bg-[#e3f0db] px-2 py-0.5 rounded-md"><CheckCircle2 className="h-3 w-3" /> MASTERED</span>}
            </div>
            <p className="text-[11px] font-medium text-[#8a6b3d]">Verse {activeGlobalIndex} / {TOTAL_SHLOKAS}</p>
          </div>

          <div className="flex rounded-xl bg-[#e5d4b5]/50 p-1 mb-4">
            {(["transliteration", "english", "sanskrit"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setState((prev) => ({ ...prev, contentMode: mode }))}
                className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  state.contentMode === mode ? "bg-white text-[#6a4918] shadow-sm" : "text-[#8c744f]"
                }`}
              >
                {mode.slice(0,3)}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col justify-center items-center py-2 px-1 relative">
            {state.contentMode === "sanskrit" && (
              <p className="whitespace-pre-line text-center font-serif text-[1.4rem] leading-[1.6] text-[#332514]">
                {active.sanskrit.replace(/\n{2,}/g, "\n")}
              </p>
            )}
            {state.contentMode === "transliteration" && (
              <p className="whitespace-pre-line text-center text-[1rem] leading-[1.8] font-medium text-[#46351d]">
                {active.transliteration}
              </p>
            )}
            {state.contentMode === "english" && (
              <div className="text-center">
                <p className="text-[0.95rem] leading-[1.7] text-[#46351d]">
                  {active.english}
                </p>
                <p className="mt-4 text-[10px] uppercase tracking-wider font-semibold text-[#a38a60]">— {active.translationAuthor} —</p>
              </div>
            )}
          </div>

          {!audioAvailable ? (
            <p className="mt-2 inline-flex items-center justify-center gap-1 text-[11px] text-[#8a3f2f] w-full">
              <AlertCircle className="h-3.5 w-3.5" />
              Audio not available
            </p>
          ) : null}

          <div className="mt-6 border-t border-[#dfcdab]/60 pt-5">
            <p className="text-center text-[9px] font-bold uppercase tracking-widest text-[#a88d63] mb-4">Practice Progress</p>
            <div className="flex justify-between px-1">
              {LOOP_STEPS.map((step) => {
                const isDone = activeProgress[step];
                return (
                  <button
                    key={`${active.id}-${step}`}
                    onClick={() => markStep(active.id, step)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full border-[2px] transition-all ${
                      isDone ? "border-[#629446] bg-[#edf6e6] text-[#426b2d] scale-105" : "border-[#d8c39e] bg-white text-[#b59f77] active:scale-95"
                    }`}>
                      {isDone ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-[11px] font-bold">{step[0].toUpperCase()}</span>}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isDone ? "text-[#426b2d]" : "text-[#a88d63]"}`}>
                      {step.slice(0, 4)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </article>

        <div className="flex gap-2 pb-[10px]">
          <button onClick={() => setConfirmLearnedOpen(true)} className="flex-1 rounded-[1.25rem] border border-[#8f6422] bg-[#8f6422] py-3.5 text-sm font-bold text-white shadow-md shadow-[#8f6422]/20 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Mark as Learned
          </button>
          
          <div className="relative w-20">
            <select
              value={active.chapter}
              onChange={(e) => {
                const ch = Number(e.target.value);
                const idx = SHLOKAS.findIndex((s) => s.chapter === ch);
                if (idx >= 0) setState((prev) => ({ ...prev, activeIndex: idx, expandedText: false }));
              }}
              className="h-full w-full appearance-none rounded-[1.25rem] border border-[#d8c39e] bg-[#fbf5e8] pl-2 pr-6 text-center text-xs font-bold text-[#654f2e]"
            >
              {chapterList.map((chapter) => (
                <option key={chapter} value={chapter}>Ch {chapter}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#654f2e]" />
          </div>
        </div>
      </div>

      <section className="fixed inset-x-3 bottom-4 z-30 rounded-[2.5rem] border border-[#d5be93] bg-[#fffaf0]/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_20px_40px_rgba(73,51,16,0.15)] backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-3">
          <span className="w-8 text-[10px] font-bold text-[#8a6b3d]">{formatTime(audioCurrentTime)}</span>
          <div className="relative flex-1 flex items-center group h-4">
            <input
              type="range"
              min={0}
              max={audioDuration || 0}
              step={0.1}
              value={Math.min(audioCurrentTime, audioDuration || 0)}
              onChange={(e) => seekAudio(Number(e.target.value))}
              disabled={!audioAvailable || !audioDuration}
              className="absolute w-full h-1.5 appearance-none bg-transparent accent-[#8f6422] z-10 cursor-pointer disabled:opacity-50"
            />
            <div className="absolute left-0 right-0 h-1.5 rounded-full bg-[#ecdab7] pointer-events-none" />
            <div 
              className="absolute left-0 h-1.5 rounded-full bg-[#8f6422] pointer-events-none" 
              style={{ width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` }} 
            />
          </div>
          <span className="w-8 text-right text-[10px] font-bold text-[#8a6b3d]">{formatTime(audioDuration)}</span>
        </div>

        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => {
              if (!audioLoop && !autoAdvance) setAudioLoop(true);
              else if (audioLoop) { setAudioLoop(false); setAutoAdvance(true); }
              else setAutoAdvance(false);
            }}
            className={`flex h-10 w-10 flex-col items-center justify-center rounded-full text-[9px] font-bold transition-colors ${
              audioLoop || autoAdvance ? "bg-[#fcebc4] text-[#8f6422]" : "text-[#9a8058] active:bg-[#f3e6cd]"
            }`}
          >
            {audioLoop ? "1x" : autoAdvance ? "∞" : "Off"}
            <span className="mt-0.5 text-[7px] uppercase tracking-widest">{audioLoop ? "Loop" : autoAdvance ? "Auto" : ""}</span>
          </button>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setState((prev) => ({ ...prev, activeIndex: Math.max(0, prev.activeIndex - 1), expandedText: false }))}
              disabled={isFirst}
              className="flex h-12 w-12 items-center justify-center rounded-full text-[#6a4f27] disabled:opacity-30 active:bg-[#f3e6cd] transition-colors"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            
            <button
              onClick={togglePlayPause}
              disabled={!audioAvailable}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8f6422] text-white shadow-[0_8px_16px_rgba(143,100,34,0.3)] disabled:opacity-50 active:scale-95 transition-transform"
            >
              {audioState === "playing" ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
            </button>

            <button
              onClick={() => setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1), expandedText: false }))}
              disabled={isLast}
              className="flex h-12 w-12 items-center justify-center rounded-full text-[#6a4f27] disabled:opacity-30 active:bg-[#f3e6cd] transition-colors"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </div>

          <button
            onClick={stopAudio}
            disabled={!audioAvailable || audioState === "idle"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#9a8058] disabled:opacity-30 active:bg-[#f3e6cd] transition-colors"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </section>

      <audio
        ref={audioRef}
        src={audioSrc}
        loop={audioLoop}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setAudioAvailable(true);
          setAudioDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0);
        }}
        onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setAudioState("playing")}
        onPause={() => setAudioState((prev) => (prev === "unavailable" ? prev : "paused"))}
          onEnded={() => {
            if (audioLoop) {
              // loop handled natively
            } else if (autoAdvance && !isLast) {
              setPendingAutoPlay(true);
              setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1), expandedText: false }));
            } else {
              setAudioState("idle");
              setAudioCurrentTime(0);
            }
          }}
          onError={() => {
          setAudioAvailable(false);
          setAudioState("unavailable");
          setAudioCurrentTime(0);
          setAudioDuration(0);
        }}
      />

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
