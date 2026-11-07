"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Undo2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { TOTAL_SHLOKAS } from "@/lib/shlokas";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShlokaState } from "@/hooks/use-shloka-state";
import { useProfile } from "@/hooks/use-profile";
import { ShlokaCard } from "@/components/shloka-card";
import { AudioPlayer } from "@/components/audio-player";
import { LoaderQuote } from "@/components/loader-quote";
import { DialogCard } from "@/components/dialog-card";
import { AudioErrorBoundary } from "@/components/audio-error-boundary";
import { ProfileSheet } from "@/components/profile-sheet";
import { useSession } from "@/hooks/use-session";
import { OfflineLibrary } from "@/components/offline-library";
import { VerseStudy } from "@/components/verse-study";
import { ReviewQueue } from "@/components/review-queue";
import { LinePractice } from "@/components/line-practice";
import { StudyTools } from "@/components/study-tools";
import { SaveStatus } from "@/components/save-status";
import { AllVerses } from "@/components/all-verses";

function LoginScreen({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await onSignIn();
    } catch (error: unknown) {
      console.error("Login failed", error);
      alert("Login failed: " + ((error as Error)?.message || "Unknown error"));
      setSigningIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f2e8d0] dark:bg-[#15100a] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full bg-[#fffaf0] dark:bg-[#1e1710] p-8 rounded-3xl border border-[#f0d498] dark:border-[#423321] shadow-2xl text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] border border-[#c4a062] dark:border-[#423321] text-3xl text-[#4a3615]">ॐ</div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#4a3615] dark:text-[#f0e3ce] leading-tight">Bhagavad Gita</h1>
          <p className="text-sm text-[#705735] dark:text-[#bda27e] mt-2">Sign in to start learning</p>
        </div>
        <button
          onClick={handleLogin}
          disabled={signingIn}
          className="w-full rounded-xl bg-gradient-to-r from-[#8a6b3d] to-[#6b512c] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(138,107,61,0.3)] transition-transform active:scale-95 disabled:opacity-60"
        >
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
      </div>
    </main>
  );
}

export default function Home() {
  const [confirmLearnedOpen, setConfirmLearnedOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<"learn" | "all">("learn");
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [linePracticeActive, setLinePracticeActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { theme, setTheme } = useTheme();

  const { user, checking: authChecking, signIn, signOut } = useSession();

  const { isFavorite, toggleFavorite, displayName, setCustomName, profile, setLineCues } = useProfile(user);

  const {
    ready, state,
    markStep, recallMissed, markAsLearned, undoLearnedForActive,
    goTo, goToShloka, next, prev, setContentMode, setActiveMode,
    completedCount, completedShlokas, streak, progressPct, winRatePct,
    active, activeProgress, activeGlobalIndex,
    isFirst, isLast, isMastered, dailyGoal, learnedToday, dueReviews, chapterList,
    rateRecall, syncStatus, storageError, online, retrySave
  } = useShlokaState(user?.uid ?? null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== "learn" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('[role="dialog"]') || (event.target instanceof Element && event.target.closest('input,textarea,select,button,a,summary,[role="slider"],[contenteditable="true"]'))) return;
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, view]);

  if (authChecking || (!ready && user)) return <LoaderQuote />;

  if (!user) return <LoginScreen onSignIn={signIn} />;

  if (!active) return null;

  const audioSrc = `/audio/${active.reference}.mp3`;

  const todayLearnedStr = `${learnedToday} / ${dailyGoal}`;

  return (
    <main className="min-h-screen overflow-y-auto bg-background text-foreground px-3 pb-40" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
        <header className="flex items-center justify-between px-1">
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-bold text-[#4a3615] dark:text-[#f0e3ce] leading-tight whitespace-nowrap flex items-center gap-1.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] border border-[#c4a062] dark:border-[#423321] text-sm">ॐ</span>
              Bhagavad Gita
            </h1>
            <p className="text-xs text-[#705735] dark:text-[#bda27e] mt-0.5">Daily Goal: {todayLearnedStr} completed</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Open profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] border border-[#c4a062] dark:border-[#423321] text-[#4a3615] text-xs font-bold hover:opacity-80 transition-opacity"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"
              )}
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321] text-[#8f6422] dark:text-[#d4aa61]"
            >
              {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </button>
            {view === "learn" && <button
              onClick={() => {
                if (isMastered) undoLearnedForActive(active.id);
                else setConfirmLearnedOpen(true);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${isMastered ? "border-[#c1e0b0] dark:border-[#284f1d] bg-[#e8f5df] dark:bg-[#142610] text-[#2c5d1f] dark:text-[#88c775]" : "border-[#ebd6ab] dark:border-[#423321] bg-white dark:bg-[#1e1710] text-[#8a6b3d] dark:text-[#bda27e] hover:bg-[#fcf5e3] dark:bg-[#2d2218]"}`}
            >
              {isMastered ? <Undo2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <span>{isMastered ? "Undo" : "Learned"}</span>
            </button>}
          </div>
        </header>

        <button
          onClick={() => setStatsOpen(true)}
          className="flex items-center justify-between rounded-2xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] p-3 sm:p-4 shadow-[0_2px_8px_rgba(143,100,34,0.06)] relative overflow-hidden group w-full text-left"
        >
          <div className="relative z-20">
            <p className="text-[10px] font-bold tracking-widest text-[#705735] dark:text-[#bda27e] uppercase mb-0.5">Session Progress</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-[#4a3615] dark:text-[#f0e3ce] tabular-nums">{completedCount} / {TOTAL_SHLOKAS}</span>
              <span className="text-[10px] font-medium text-[#705735] dark:text-[#bda27e]">verses learned</span>
            </div>
          </div>
          <span className="text-lg font-bold tabular-nums text-[#8f6422] dark:text-[#d4aa61]">{progressPct}%</span>
        </button>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#fcebc4] p-1 dark:bg-[#2d2218]" role="group" aria-label="View">
          {([["learn", "Learn 108"], ["all", "All verses"]] as const).map(([id, label]) => (
            <button key={id} aria-pressed={view === id} onClick={() => { setView(id); window.scrollTo({ top: 0 }); }}
              className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${view === id ? "bg-white text-[#8f6422] shadow-sm dark:bg-[#1e1710] dark:text-[#d4aa61]" : "text-[#705735] dark:text-[#bda27e]"}`}>{label}</button>
          ))}
        </div>
        {view === "all" ? (
          <AllVerses onStudy={(id) => { goToShloka(id); setView("learn"); window.scrollTo({ top: 0 }); }} />
        ) : (
          <>
        <ShlokaCard
          active={active}
          activeGlobalIndex={activeGlobalIndex}
          isMastered={isMastered}
          contentMode={state.contentMode}
          setContentMode={setContentMode}
          audioAvailable={audioAvailable}
          activeProgress={activeProgress}
          onMarkStep={markStep}
          onRecallMissed={recallMissed}
          onSwipeLeft={next}
          onSwipeRight={prev}
          onJumpTo={goTo}
          isFavorite={isFavorite(active.id)}
          onToggleFavorite={() => toggleFavorite(active.id)}
        />
        <StudyTools dueCount={dueReviews.length}>
          <ReviewQueue due={dueReviews} reviews={state.reviews} onRate={rateRecall} onJump={goToShloka} />
          <LinePractice key={active.id} shloka={active} audioRef={audioRef} cues={profile.lineCues[active.id]} onSave={(cues) => setLineCues(active.id, cues)} onActiveChange={setLinePracticeActive} />
          <VerseStudy shloka={active} />
          <OfflineLibrary reference={active.reference} />
        </StudyTools>
          </>
        )}
        {(storageError || syncStatus === "error" || !online) && <SaveStatus status={syncStatus} storageError={storageError} online={online} onRetry={retrySave} />}
      </div>

      {view === "learn" && <AudioErrorBoundary>
        <AudioPlayer
          audioSrc={audioSrc}
          elementRef={audioRef}
          linePracticeActive={linePracticeActive}
          title={`Ch ${active.chapter} · V ${active.verse}`}
          isFirst={isFirst}
          isLast={isLast}
          audioAvailable={audioAvailable}
          setAudioAvailable={setAudioAvailable}
          onNext={next}
          onPrev={prev}
        />
      </AudioErrorBoundary>}

      {/* Confirm learned dialog */}
      <Dialog open={confirmLearnedOpen} onOpenChange={setConfirmLearnedOpen}>
        <DialogCard maxWidth="max-w-xs sm:max-w-sm" responsiveRounded responsivePadding>
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold text-[#4a3615] dark:text-[#f0e3ce]">Mark as Learned?</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#6b5532] dark:text-[#bda27e] leading-relaxed mt-2">
              This marks all 4 steps complete for <span className="font-semibold">Ch {active.chapter} · V {active.verse}</span> and moves to the next verse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row gap-2">
            <button
              onClick={() => setConfirmLearnedOpen(false)}
              className="flex-1 rounded-xl border-2 border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#1e1710] px-4 py-3 sm:py-2 text-xs sm:text-sm font-semibold text-[#6b512c] dark:text-[#d4aa61] hover:bg-[#fcebc4] dark:hover:bg-[#2d2218] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmLearnedOpen(false); markAsLearned(active.id); }}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#8a6b3d] to-[#6b512c] px-4 py-3 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-[0_4px_12px_rgba(138,107,61,0.3)] hover:shadow-[0_6px_16px_rgba(138,107,61,0.4)] transition-shadow active:scale-95"
            >
              Yes, Mark Learned
            </button>
          </DialogFooter>
        </DialogCard>
      </Dialog>

      {/* Completed shlokas dialog */}
      <Dialog open={completedOpen} onOpenChange={setCompletedOpen}>
        <DialogCard maxWidth="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Completed Shlokas</DialogTitle>
            <DialogDescription className="text-xs text-[#5f4a2b]">
              {completedShlokas.length} of {TOTAL_SHLOKAS} shlokas learned
            </DialogDescription>
          </DialogHeader>
          {completedShlokas.length === 0 ? (
            <p className="text-xs text-[#6b5532] dark:text-[#bda27e] py-2">No completed shlokas yet. Keep practicing!</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-4">
                {chapterList.map((ch) => {
                  const chCompleted = completedShlokas.filter((s) => s.chapter === ch);
                  if (chCompleted.length === 0) return null;
                  return (
                    <div key={ch}>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#705735] dark:text-[#bda27e] mb-2 border-b border-[#f0d498] dark:border-[#423321] pb-1">Chapter {ch}</h4>
                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                        {chCompleted.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { setCompletedOpen(false); goToShloka(s.id); }}
                            className="flex flex-col items-center justify-center rounded-lg bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321] py-2 transition-colors hover:bg-[#ebd6ab]"
                          >
                            <span className="text-[10px] font-semibold text-[#8f6422] dark:text-[#d4aa61]">{s.chapter}.{s.verse}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogCard>
      </Dialog>
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogCard maxWidth="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#4a3615] dark:text-[#f0e3ce]">Your Stats</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{streak}</span>
              <span className="text-[10px] uppercase font-bold text-[#705735] dark:text-[#bda27e]">Day Streak</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{completedCount}</span>
              <span className="text-[10px] uppercase font-bold text-[#705735] dark:text-[#bda27e]">Mastered</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{state.recallAttempts}</span>
              <span className="text-[10px] uppercase font-bold text-[#705735] dark:text-[#bda27e]">Total Attempts</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">
                {winRatePct}%
              </span>
              <span className="text-[10px] uppercase font-bold text-[#705735] dark:text-[#bda27e]">Win Rate</span>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <button
              onClick={() => setProfileOpen(true)}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#8a6b3d] to-[#6b512c] px-4 py-2 text-xs font-bold text-white shadow-[0_4px_12px_rgba(138,107,61,0.3)] hover:shadow-[0_6px_16px_rgba(138,107,61,0.4)] transition-shadow active:scale-95"
            >
              View Profile
            </button>
          </DialogFooter>
        </DialogCard>
      </Dialog>

      {/* Profile Sheet */}
      <ProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        onSignOut={signOut}
        startedAt={state.startedAt}
        activeMode={state.activeMode}
        setActiveMode={setActiveMode}
        completedCount={completedCount}
        streak={streak}
        winRatePct={winRatePct}
        displayName={displayName}
        setCustomName={setCustomName}
      />
    </main>
  );
}
