"use client";

import { useEffect, useState } from "react";
import { Flame, CheckCircle2, ChevronLeft, ChevronRight, CheckCircle, Undo2, ChevronDown, Settings, Download, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SHLOKAS, TOTAL_SHLOKAS } from "@/lib/shlokas";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShlokaState } from "@/hooks/use-shloka-state";
import { ShlokaCard } from "@/components/shloka-card";
import { AudioPlayer } from "@/components/audio-player";

export default function Home() {
  const [confirmLearnedOpen, setConfirmLearnedOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const { theme, setTheme } = useTheme();

  const handleExportBackup = () => {
    try {
      const data = localStorage.getItem("gita-108-state");
      if (!data) return;
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gita-108-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Backup failed", e);
    }
  };

  const {
    ready, state, setState,
    markStep, markAsLearned, undoLearnedForActive,
    completedCount, completedShlokas, streak, progressPct,
    active, safeActiveIndex, activeProgress, activeGlobalIndex,
    isFirst, isLast, isMastered, dailyGoal, firstPending, chapterList
  } = useShlokaState();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1) }));
      if (event.key === "ArrowLeft") setState((prev) => ({ ...prev, activeIndex: Math.max(0, prev.activeIndex - 1) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setState]);

  if (!ready || !active) return <main className="min-h-screen bg-[#f2e8d0]" />;

  const audioSrc = `/audio/${active.reference}.mp3`;

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const todayLearnedStr = state.lastPracticeDate === todayIso() ? `${dailyGoal} / ${dailyGoal}` : `0 / ${dailyGoal}`;

  return (
    <main className="min-h-screen overflow-y-auto bg-background text-foreground px-3 pb-40" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
        <header className="flex items-center gap-2 px-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif text-xl font-bold text-[#4a3615] leading-tight whitespace-nowrap">Bhagavad Gita</h1>
            </div>
            <p className="text-xs text-[#a88d63] mt-0.5">Daily Goal: {todayLearnedStr} completed</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="flex items-center gap-1 rounded-full bg-[#fcebc4] dark:bg-[#4a3615] border border-[#f0d498] dark:border-[#5c431b] px-2 py-1 text-[11px] font-semibold text-[#8f6422] dark:text-[#ebd6ab]"
            >
              {theme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
            </button>
            <button
              onClick={() => setState(p => ({ ...p, activeMode: p.activeMode === "normal" ? "lite" : "normal" }))}
              aria-label={`Toggle mode (current: ${state.activeMode})`}
              className="flex items-center gap-1 rounded-full bg-[#fcebc4] dark:bg-[#4a3615] border border-[#f0d498] dark:border-[#5c431b] px-2 py-1 text-[11px] font-semibold text-[#8f6422] dark:text-[#ebd6ab] capitalize"
            >
              <Settings className="h-3 w-3" aria-hidden="true" />
              <span>{state.activeMode}</span>
            </button>
            <button
              onClick={() => setStatsOpen(true)}
              aria-label="View Stats"
              className="flex items-center gap-1 rounded-full bg-[#fcebc4] dark:bg-[#4a3615] border border-[#f0d498] dark:border-[#5c431b] px-2 py-1 text-[11px] font-semibold text-[#8f6422] dark:text-[#ebd6ab]"
            >
              <Flame className="h-3 w-3" aria-hidden="true" />
              <span>{streak}d</span>
            </button>
            <button
              onClick={() => setCompletedOpen(true)}
              aria-label={`View ${completedCount} completed shlokas`}
              className="flex items-center gap-1 rounded-full bg-[#e8f5df] border border-[#c1e0b0] px-2 py-1 text-[11px] font-semibold text-[#2c5d1f]"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span>{completedCount}</span>
            </button>
            <span className="text-[10px] font-semibold tabular-nums text-[#a88d63]">{progressPct}%</span>
          </div>
        </header>

        <div className="flex items-center justify-between rounded-2xl bg-[#fffaf0] border border-[#f0d498] p-3 sm:p-4 shadow-[0_2px_8px_rgba(143,100,34,0.06)] relative overflow-hidden group">
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#fffaf0] via-[#fffaf0] to-transparent z-10 sm:hidden pointer-events-none" />
          <div className="flex items-center gap-3 relative z-20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] shadow-inner border border-[#c4a062]">
              <span className="font-serif text-lg font-bold text-[#4a3615]">ॐ</span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-[#a88d63] uppercase mb-0.5">Session Progress</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-[#4a3615] tabular-nums">{completedCount} / {TOTAL_SHLOKAS}</span>
                <span className="text-[10px] font-medium text-[#c0a986]">verses learned</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 mb-1 mt-2">
          <button
            onClick={() => !isFirst && setState((prev) => ({ ...prev, activeIndex: prev.activeIndex - 1 }))}
            disabled={isFirst}
            aria-label="Previous shloka"
            className="flex items-center gap-1 rounded-full bg-white border border-[#ebd6ab] px-3 py-1.5 text-xs font-semibold text-[#8a6b3d] shadow-sm disabled:opacity-40 disabled:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (isMastered) undoLearnedForActive(active.id);
                else setConfirmLearnedOpen(true);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${isMastered ? "border-[#c1e0b0] bg-[#e8f5df] text-[#2c5d1f]" : "border-[#ebd6ab] bg-white text-[#8a6b3d] hover:bg-[#fcf5e3]"}`}
            >
              {isMastered ? <Undo2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <span className="hidden sm:inline">{isMastered ? "Undo Learned" : "Mark as Learned"}</span>
            </button>
          </div>

          <button
            onClick={() => !isLast && setState((prev) => ({ ...prev, activeIndex: prev.activeIndex + 1 }))}
            disabled={isLast}
            aria-label="Next shloka"
            className="flex items-center gap-1 rounded-full bg-white border border-[#ebd6ab] px-3 py-1.5 text-xs font-semibold text-[#8a6b3d] shadow-sm disabled:opacity-40 disabled:bg-transparent"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <ShlokaCard
          active={active}
          activeGlobalIndex={activeGlobalIndex}
          isMastered={isMastered}
          contentMode={state.contentMode}
          setContentMode={(m) => setState((p) => ({ ...p, contentMode: m }))}
          audioAvailable={audioAvailable}
          activeProgress={activeProgress}
          onMarkStep={markStep}
          onSwipeLeft={() => !isLast && setState((prev) => ({ ...prev, activeIndex: prev.activeIndex + 1 }))}
          onSwipeRight={() => !isFirst && setState((prev) => ({ ...prev, activeIndex: prev.activeIndex - 1 }))}
        />
      </div>

      <AudioPlayer
        audioSrc={audioSrc}
        isFirst={isFirst}
        isLast={isLast}
        audioAvailable={audioAvailable}
        setAudioAvailable={setAudioAvailable}
        onNext={() => setState(p => ({ ...p, activeIndex: Math.min(SHLOKAS.length - 1, p.activeIndex + 1) }))}
        onPrev={() => setState(p => ({ ...p, activeIndex: Math.max(0, p.activeIndex - 1) }))}
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
              onClick={() => { setConfirmLearnedOpen(false); markAsLearned(active.id); }}
              className="rounded-xl bg-gradient-to-r from-[#8a6b3d] to-[#6b512c] px-4 py-2 text-xs font-bold text-white shadow-[0_4px_12px_rgba(138,107,61,0.3)]"
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
            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-4">
                {chapterList.map((ch) => {
                  const chCompleted = completedShlokas.filter((s) => s.chapter === ch);
                  if (chCompleted.length === 0) return null;
                  return (
                    <div key={ch}>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#a88d63] mb-2 border-b border-[#f0d498] pb-1">Chapter {ch}</h4>
                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                        {chCompleted.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { setCompletedOpen(false); setState(prev => ({ ...prev, activeIndex: SHLOKAS.findIndex(x => x.id === s.id) })); }}
                            className="flex flex-col items-center justify-center rounded-lg bg-[#fcebc4] border border-[#f0d498] py-2 transition-colors hover:bg-[#ebd6ab]"
                          >
                            <span className="text-[10px] font-semibold text-[#8f6422]">{s.chapter}.{s.verse}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="max-w-sm border-[#ccb385] !bg-white dark:!bg-[#2f2415] p-5 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#4a3615] dark:text-[#ebd6ab]">Your Stats</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#3d2c10] border border-[#f0d498] dark:border-[#5c431b]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#ebd6ab]">{streak}</span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#c0a986]">Day Streak</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#3d2c10] border border-[#f0d498] dark:border-[#5c431b]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#ebd6ab]">{completedCount}</span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#c0a986]">Mastered</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#3d2c10] border border-[#f0d498] dark:border-[#5c431b]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#ebd6ab]">{state.history ? Object.keys(state.history).length : 0}</span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#c0a986]">Total Attempts</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#3d2c10] border border-[#f0d498] dark:border-[#5c431b]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#ebd6ab]">
                {state.history ? Math.round((completedCount / Math.max(1, Object.keys(state.history).length)) * 100) : 0}%
              </span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#c0a986]">Win Rate</span>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={handleExportBackup}
              className="w-full flex justify-center items-center gap-2 rounded-xl border border-[#ccb385] dark:border-[#5c431b] bg-white dark:bg-[#3d2c10] px-4 py-2 text-xs font-semibold text-[#5c482a] dark:text-[#ebd6ab]"
            >
              <Download className="h-4 w-4" /> Export Backup
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
