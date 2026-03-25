"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Headphones,
  Lightbulb,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Square,
  Undo2,
} from "lucide-react";
import { DAILY_TARGET, LoopStep, SHLOKAS, TOTAL_SHLOKAS } from "@/lib/shlokas";
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

const STEP_CONFIG: Record<LoopStep, { Icon: React.ComponentType<{ className?: string }>; label: string }> = {
  listen:     { Icon: Headphones, label: "Listen" },
  repeat:     { Icon: RotateCcw,  label: "Repeat" },
  understand: { Icon: BookOpen,   label: "Grasp"  },
  recall:     { Icon: Brain,      label: "Recall" },
};

const CONTENT_TABS: { mode: AppState["contentMode"]; label: string }[] = [
  { mode: "transliteration", label: "Roman" },
  { mode: "english",         label: "Meaning" },
  { mode: "sanskrit",        label: "Sanskrit" },
];

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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
  const streak = Math.max(1, daysBetween(state.startedAt, todayIso()) + 1);
  const progressPct = Math.round((completedCount / TOTAL_SHLOKAS) * 100);

  const safeActiveIndex = Math.max(0, Math.min(SHLOKAS.length - 1, state.activeIndex));
  const active = SHLOKAS[safeActiveIndex];
  const activeProgress = active ? state.completed[active.id] ?? defaultStepProgress() : defaultStepProgress();
  const activeGlobalIndex = safeActiveIndex + 1;
  const isFirst = activeGlobalIndex === 1;
  const isLast = activeGlobalIndex === TOTAL_SHLOKAS;
  const audioSrc = `/audio/${active.reference}.mp3`;
  const isMastered = fullDone(activeProgress);

  const dailyGoal = state.activeMode === "lite" ? 1 : DAILY_TARGET;
  const firstPending = Math.max(0, SHLOKAS.findIndex((item) => !fullDone(state.completed[item.id])));
  const chapterList = useMemo(() => [...new Set(SHLOKAS.map((s) => s.chapter))].sort((a, b) => a - b), []);

  // Swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only horizontal swipes (not scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0 && !isLast) {
        setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1), expandedText: false }));
      } else if (deltaX > 0 && !isFirst) {
        setState((prev) => ({ ...prev, activeIndex: Math.max(0, prev.activeIndex - 1), expandedText: false }));
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
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

  const toggleLoopMode = () => {
    if (!audioLoop && !autoAdvance) setAudioLoop(true);
    else if (audioLoop) { setAudioLoop(false); setAutoAdvance(true); }
    else setAutoAdvance(false);
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
          .then(() => { setAudioState("playing"); })
          .catch(() => { setAudioState("unavailable"); setAudioAvailable(false); })
          .finally(() => { setPendingAutoPlay(false); });
      }
    } else {
      setAudioState("idle");
    }
  }, [active.reference, pendingAutoPlay]);

  if (!ready || !active) return <main className="min-h-screen bg-[#f2e8d0]" />;

  const loopActive = audioLoop || autoAdvance;

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_20%_10%,_#fff7df_0%,_#f4e9cb_45%,_#e8d9b4_100%)] px-3 pt-2 pb-40 text-[#2f2415]">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2">

        {/* Header — single compact row */}
        <header className="flex items-center gap-2 pt-2 px-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif text-xl font-bold text-[#4a3615] leading-tight whitespace-nowrap">Bhagavad Gita</h1>
              <span className="text-[9px] font-medium tracking-[0.18em] text-[#8a6b3d] uppercase hidden xs:block">Daily Practice</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 rounded-full bg-[#fcebc4] border border-[#f0d498] px-2 py-1 text-[11px] font-semibold text-[#8f6422]">
              <Flame className="h-3 w-3" />
              <span>{streak}d</span>
            </div>
            <button
              onClick={() => setCompletedOpen(true)}
              aria-label={`View ${completedCount} completed shlokas`}
              className="flex items-center gap-1 rounded-full bg-[#e8f5df] border border-[#c1e0b0] px-2 py-1 text-[11px] font-semibold text-[#2c5d1f]"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{completedCount}</span>
            </button>
            <span className="text-[10px] font-semibold tabular-nums text-[#a88d63]">{progressPct}%</span>
          </div>
        </header>

        {/* Journey progress bar — no label row */}
        <div className="h-1 w-full rounded-full bg-[#e5d4b5] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8f6422] to-[#c49a3c] transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Main shloka card */}
        <article
          className="relative flex flex-col rounded-[2rem] border border-[#cbb389] bg-gradient-to-br from-[#fffdf8] via-[#fdf8ee] to-[#f8ead0] p-4 shadow-md"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Badge row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg bg-[#eee0c3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#6c532d]">
                Ch {active.chapter} · V {active.verse}
              </span>
              {isMastered && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#356d25] bg-[#e3f0db] px-2.5 py-1 rounded-lg border border-[#b8dda8]">
                  <CheckCircle2 className="h-3 w-3" /> Mastered
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium tabular-nums text-[#8a6b3d] shrink-0">{activeGlobalIndex} / {TOTAL_SHLOKAS}</p>
          </div>

          {/* Content mode tabs */}
          <div className="flex rounded-xl bg-[#e5d4b5]/50 p-1 mb-3">
            {CONTENT_TABS.map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => setState((prev) => ({ ...prev, contentMode: mode }))}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold tracking-wide transition-all duration-150 ${
                  state.contentMode === mode
                    ? "bg-white text-[#6a4918] shadow-sm"
                    : "text-[#8c744f]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Text content */}
          <div className="flex flex-col justify-center items-center py-2 px-1">
            {state.contentMode === "sanskrit" && (
              <p className="whitespace-pre-line text-center font-serif text-[1.45rem] leading-[1.85] text-[#332514]">
                {active.sanskrit.replace(/\n{2,}/g, "\n")}
              </p>
            )}
            {state.contentMode === "transliteration" && (
              <p className="whitespace-pre-line text-center text-[1rem] leading-[2.1] font-medium text-[#46351d] italic">
                {active.transliteration}
              </p>
            )}
            {state.contentMode === "english" && (
              <div className="w-full flex flex-col gap-3">
                <p className="text-center text-[0.95rem] leading-[1.8] text-[#46351d]">
                  {active.english}
                </p>
                <p className="text-center text-[10px] uppercase tracking-wider font-semibold text-[#a38a60]">
                  — {active.translationAuthor} —
                </p>
                {active.reflectionPrompt && (
                  <div className="mt-1 rounded-2xl bg-[#fdf6e3] border border-[#e8d4a0] px-4 py-3 flex gap-2.5 items-start">
                    <Lightbulb className="h-4 w-4 text-[#b8860b] mt-0.5 shrink-0" />
                    <p className="text-[12px] leading-[1.65] text-[#7a5e2a] italic">{active.reflectionPrompt}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {!audioAvailable && (
            <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-[11px] text-[#8a3f2f] w-full">
              <AlertCircle className="h-3.5 w-3.5" />
              Audio not available for this verse
            </p>
          )}

          {/* Practice steps */}
          <div className="mt-3 border-t border-[#dfcdab]/60 pt-3">
            <p className="text-center text-[9px] font-bold uppercase tracking-widest text-[#a88d63] mb-3">Practice Steps</p>
            <div className="flex justify-between px-1">
              {LOOP_STEPS.map((step) => {
                const isDone = activeProgress[step];
                const { Icon, label } = STEP_CONFIG[step];
                return (
                  <button
                    key={`${active.id}-${step}`}
                    onClick={() => markStep(active.id, step)}
                    aria-label={`${isDone ? "Unmark" : "Mark"} ${label}`}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all duration-200 ${
                      isDone
                        ? "border-[#629446] bg-[#edf6e6] text-[#426b2d] shadow-sm"
                        : "border-[#d8c39e] bg-white/80 text-[#b59f77] active:scale-95 active:border-[#8f6422] active:bg-[#fdf0d8]"
                    }`}>
                      {isDone
                        ? <CheckCircle2 className="h-5 w-5 text-[#426b2d]" />
                        : <Icon className="h-[18px] w-[18px]" />
                      }
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isDone ? "text-[#426b2d]" : "text-[#a88d63]"}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Swipe hint */}
          <div className="flex items-center justify-center gap-1.5 mt-2 select-none">
            <ChevronLeft className={`h-3 w-3 transition-opacity ${isFirst ? "opacity-0" : "opacity-25 text-[#8a6b3d]"}`} />
            <span className="text-[8px] font-medium tracking-[0.15em] uppercase text-[#8a6b3d] opacity-30">swipe to navigate</span>
            <ChevronRight className={`h-3 w-3 transition-opacity ${isLast ? "opacity-0" : "opacity-25 text-[#8a6b3d]"}`} />
          </div>
        </article>

        {/* Action bar */}
        <div className="flex gap-2 pb-1">
          {isMastered ? (
            <button
              onClick={undoLearnedForActive}
              className="flex-1 rounded-[1.25rem] border border-[#c8b48e] bg-white py-3.5 text-sm font-bold text-[#7a5e2a] shadow-sm flex items-center justify-center gap-2 active:bg-[#fdf5e4] transition-colors"
            >
              <Undo2 className="h-4 w-4" /> Undo Learned
            </button>
          ) : (
            <button
              onClick={() => setConfirmLearnedOpen(true)}
              className="flex-1 rounded-[1.25rem] border border-[#8f6422] bg-[#8f6422] py-3.5 text-sm font-bold text-white shadow-md shadow-[#8f6422]/20 flex items-center justify-center gap-2 active:bg-[#7a5519] transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> Mark as Learned
            </button>
          )}

          <div className="relative w-24">
            <select
              value={active.chapter}
              onChange={(e) => {
                const ch = Number(e.target.value);
                const idx = SHLOKAS.findIndex((s) => s.chapter === ch);
                if (idx >= 0) setState((prev) => ({ ...prev, activeIndex: idx, expandedText: false }));
              }}
              aria-label="Jump to chapter"
              className="h-full w-full appearance-none rounded-[1.25rem] border border-[#d8c39e] bg-[#fbf5e8] pl-3 pr-7 text-center text-xs font-bold text-[#654f2e] cursor-pointer"
            >
              {chapterList.map((chapter) => (
                <option key={chapter} value={chapter}>Ch {chapter}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#654f2e]" />
          </div>
        </div>
      </div>

      {/* Fixed audio player */}
      <section
        className="fixed inset-x-3 bottom-4 z-30 rounded-[2.5rem] border border-[#d5be93] bg-[#fffaf0]/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_20px_40px_rgba(73,51,16,0.18)] backdrop-blur-xl"
        aria-label="Audio player"
      >
        {/* Scrubber */}
        <div className="mb-3.5 flex items-center gap-3">
          <span className="w-8 text-[10px] font-bold tabular-nums text-[#8a6b3d]">{formatTime(audioCurrentTime)}</span>
          <div className="relative flex-1 h-6 flex items-center">
            {/* Track background */}
            <div className="absolute left-0 right-0 h-2 rounded-full bg-[#ecdab7] pointer-events-none" />
            {/* Track fill */}
            <div
              className="absolute left-0 h-2 rounded-full bg-[#8f6422] pointer-events-none transition-none"
              style={{ width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
            />
            {/* Thumb dot */}
            {audioDuration > 0 && (
              <div
                className="absolute h-4 w-4 rounded-full bg-[#8f6422] border-2 border-white shadow-md pointer-events-none"
                style={{ left: `calc(${(audioCurrentTime / audioDuration) * 100}% - 8px)` }}
              />
            )}
            {/* Invisible range input for interaction */}
            <input
              type="range"
              min={0}
              max={audioDuration || 0}
              step={0.1}
              value={Math.min(audioCurrentTime, audioDuration || 0)}
              onChange={(e) => seekAudio(Number(e.target.value))}
              disabled={!audioAvailable || !audioDuration}
              aria-label="Audio seek position"
              className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            />
          </div>
          <span className="w-8 text-right text-[10px] font-bold tabular-nums text-[#8a6b3d]">{formatTime(audioDuration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-1">
          {/* Loop / Auto toggle */}
          <button
            onClick={toggleLoopMode}
            aria-label={audioLoop ? "Loop once active" : autoAdvance ? "Auto-advance active" : "Playback mode off"}
            className={`flex h-10 w-10 flex-col items-center justify-center rounded-full gap-0.5 transition-colors ${
              loopActive ? "bg-[#fcebc4] text-[#8f6422]" : "text-[#b0956a] active:bg-[#f3e6cd]"
            }`}
          >
            {audioLoop ? (
              <>
                <Repeat1 className="h-[18px] w-[18px]" />
                <span className="text-[7px] font-bold tracking-widest">LOOP</span>
              </>
            ) : autoAdvance ? (
              <>
                <Repeat className="h-[18px] w-[18px]" />
                <span className="text-[7px] font-bold tracking-widest">AUTO</span>
              </>
            ) : (
              <>
                <Repeat className="h-[18px] w-[18px] opacity-35" />
                <span className="text-[7px] font-bold tracking-widest opacity-35">OFF</span>
              </>
            )}
          </button>

          {/* Nav + Play */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setState((prev) => ({ ...prev, activeIndex: Math.max(0, prev.activeIndex - 1), expandedText: false }))}
              disabled={isFirst}
              aria-label="Previous verse"
              className="flex h-12 w-12 items-center justify-center rounded-full text-[#6a4f27] disabled:opacity-25 active:bg-[#f3e6cd] transition-colors"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>

            <button
              onClick={togglePlayPause}
              disabled={!audioAvailable}
              aria-label={audioState === "playing" ? "Pause audio" : "Play audio"}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8f6422] text-white shadow-[0_8px_20px_rgba(143,100,34,0.35)] disabled:opacity-50 active:scale-95 transition-transform"
            >
              {audioState === "playing"
                ? <Pause className="h-7 w-7" />
                : <Play className="h-7 w-7 ml-0.5" />
              }
            </button>

            <button
              onClick={() => setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1), expandedText: false }))}
              disabled={isLast}
              aria-label="Next verse"
              className="flex h-12 w-12 items-center justify-center rounded-full text-[#6a4f27] disabled:opacity-25 active:bg-[#f3e6cd] transition-colors"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </div>

          {/* Stop */}
          <button
            onClick={stopAudio}
            disabled={!audioAvailable || audioState === "idle"}
            aria-label="Stop audio"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#b0956a] disabled:opacity-25 active:bg-[#f3e6cd] transition-colors"
          >
            <Square className="h-[18px] w-[18px]" />
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

      {/* Confirm learned dialog */}
      <Dialog open={confirmLearnedOpen} onOpenChange={setConfirmLearnedOpen}>
        <DialogContent className="max-w-sm border-[#ccb385] !bg-white p-5 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Mark as Learned?</DialogTitle>
            <DialogDescription className="text-xs text-[#5f4a2b] leading-relaxed">
              This marks all 4 practice steps complete for Ch {active.chapter} · V {active.verse} and advances to the next verse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 gap-2">
            <button
              onClick={() => setConfirmLearnedOpen(false)}
              className="rounded-xl border border-[#ccb385] bg-white px-4 py-2 text-xs font-semibold text-[#5c482a]"
            >
              Cancel
            </button>
            <button
              onClick={() => { markAsLearned(active.id); setConfirmLearnedOpen(false); }}
              className="rounded-xl border border-[#8f6422] bg-[#8f6422] px-4 py-2 text-xs font-semibold text-white"
            >
              Yes, Mark Learned
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completed shlokas dialog */}
      <Dialog open={completedOpen} onOpenChange={setCompletedOpen}>
        <DialogContent className="max-w-lg border-[#ccb385] !bg-white p-5 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Completed Shlokas</DialogTitle>
            <DialogDescription className="text-xs text-[#5f4a2b]">
              {completedShlokas.length} of {TOTAL_SHLOKAS} shlokas learned
            </DialogDescription>
          </DialogHeader>
          {completedShlokas.length === 0 ? (
            <p className="text-xs text-[#6b5532] py-2">No completed shlokas yet. Keep practicing!</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#e1d0ae] bg-[#fffaf0] p-3">
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
                      className="rounded-full border border-[#9fc48f] bg-[#edf8e7] px-2.5 py-1 text-[11px] font-medium text-[#315126] hover:bg-[#daf0d3] transition-colors"
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
