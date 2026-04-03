"use client";

import { useEffect, useState } from "react";
import { Flame, CheckCircle2, CheckCircle, Undo2, Download, Upload, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { SHLOKAS, TOTAL_SHLOKAS } from "@/lib/shlokas";
import { STORAGE_KEY, SCHEMA_VERSION } from "@/lib/constants";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShlokaState } from "@/hooks/use-shloka-state";
import { ShlokaCard } from "@/components/shloka-card";
import { AudioPlayer } from "@/components/audio-player";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, User } from "firebase/auth";

function LoginScreen() {
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      // If popup was blocked or closed, fall back to redirect flow
      if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user") {
        signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error("Login failed", error);
      alert("Login failed: " + (error as Error).message);
      setSigningIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f2e8d0] dark:bg-[#15100a] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full bg-[#fffaf0] dark:bg-[#1e1710] p-8 rounded-3xl border border-[#f0d498] dark:border-[#423321] shadow-2xl text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] border border-[#c4a062] dark:border-[#423321] text-3xl text-[#4a3615]">ॐ</div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#4a3615] dark:text-[#f0e3ce] leading-tight">Bhagavad Gita</h1>
          <p className="text-sm text-[#a88d63] dark:text-[#bda27e] mt-2">Sign in to start learning</p>
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
  const [audioAvailable, setAudioAvailable] = useState(true);
  const { theme, setTheme } = useTheme();
  
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const handleExportBackup = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
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

  const handleImportBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (Number(parsed.schemaVersion) !== SCHEMA_VERSION) {
            alert("Incompatible backup version.");
            return;
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          window.location.reload();
        } catch {
          alert("Invalid backup file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
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
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW registration failed:", e));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") { event.preventDefault(); setState((prev) => ({ ...prev, activeIndex: Math.min(SHLOKAS.length - 1, prev.activeIndex + 1) })); }
      if (event.key === "ArrowLeft") { event.preventDefault(); setState((prev) => ({ ...prev, activeIndex: Math.max(0, prev.activeIndex - 1) })); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setState]);

  useEffect(() => {
    // Handle redirect result after Google sign-in redirect returns
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect sign-in error:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  if (authChecking || (!ready && user)) return (
    <main className="min-h-screen bg-[#f2e8d0] dark:bg-[#15100a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#ebd6ab] dark:bg-[#2d2218] animate-pulse" />
        <div className="h-3 w-32 rounded bg-[#ebd6ab] dark:bg-[#2d2218] animate-pulse" />
      </div>
    </main>
  );

  if (!user) return <LoginScreen />;

  if (!active) return null;

  const audioSrc = `/audio/${active.reference}.mp3`;

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const todayLearnedStr = state.lastPracticeDate === todayIso() ? `${dailyGoal} / ${dailyGoal}` : `0 / ${dailyGoal}`;

  return (
    <main className="min-h-screen overflow-y-auto bg-background text-foreground px-3 pb-40" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
        <header className="flex items-center justify-between px-1">
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-bold text-[#4a3615] dark:text-[#f0e3ce] leading-tight whitespace-nowrap flex items-center gap-1.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] border border-[#c4a062] dark:border-[#423321] text-sm">ॐ</span>
              Bhagavad Gita
            </h1>
            <p className="text-xs text-[#a88d63] dark:text-[#bda27e] mt-0.5">Daily Goal: {todayLearnedStr} completed</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => signOut(auth)}
              title="Sign Out"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321] text-[#8f6422] dark:text-[#d4aa61]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321] text-[#8f6422] dark:text-[#d4aa61]"
            >
              {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => {
                if (isMastered) undoLearnedForActive(active.id);
                else setConfirmLearnedOpen(true);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${isMastered ? "border-[#c1e0b0] dark:border-[#284f1d] bg-[#e8f5df] dark:bg-[#142610] text-[#2c5d1f] dark:text-[#88c775]" : "border-[#ebd6ab] dark:border-[#423321] bg-white dark:bg-[#1e1710] text-[#8a6b3d] dark:text-[#bda27e] hover:bg-[#fcf5e3] dark:bg-[#2d2218]"}`}
            >
              {isMastered ? <Undo2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <span>{isMastered ? "Undo" : "Learned"}</span>
            </button>
          </div>
        </header>

        <button
          onClick={() => setStatsOpen(true)}
          className="flex items-center justify-between rounded-2xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] p-3 sm:p-4 shadow-[0_2px_8px_rgba(143,100,34,0.06)] relative overflow-hidden group w-full text-left"
        >
          <div className="relative z-20">
            <p className="text-[10px] font-bold tracking-widest text-[#a88d63] dark:text-[#bda27e] uppercase mb-0.5">Session Progress</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-[#4a3615] dark:text-[#f0e3ce] tabular-nums">{completedCount} / {TOTAL_SHLOKAS}</span>
              <span className="text-[10px] font-medium text-[#c0a986] dark:text-[#bda27e]">verses learned</span>
            </div>
          </div>
          <span className="text-lg font-bold tabular-nums text-[#8f6422] dark:text-[#d4aa61]">{progressPct}%</span>
        </button>

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
          onJumpTo={(index) => setState((prev) => ({ ...prev, activeIndex: index }))}
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
        <DialogContent className="max-w-sm border-[#ccb385] dark:border-[#423321] !bg-white !dark:bg-[#1e1710] p-5 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Mark as Learned?</DialogTitle>
            <DialogDescription className="text-xs text-[#5f4a2b] leading-relaxed">
              This marks all 4 practice steps complete for Ch {active.chapter} · V {active.verse} and advances to the next verse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 gap-2">
            <button
              onClick={() => setConfirmLearnedOpen(false)}
              className="rounded-xl border border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#1e1710] px-4 py-2 text-xs font-semibold text-[#5c482a]"
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
        <DialogContent className="max-w-lg border-[#ccb385] dark:border-[#423321] !bg-white !dark:bg-[#1e1710] p-5 shadow-2xl rounded-3xl">
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
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#a88d63] dark:text-[#bda27e] mb-2 border-b border-[#f0d498] dark:border-[#423321] pb-1">Chapter {ch}</h4>
                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                        {chCompleted.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { setCompletedOpen(false); setState(prev => ({ ...prev, activeIndex: SHLOKAS.findIndex(x => x.id === s.id) })); }}
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
        </DialogContent>
      </Dialog>
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="max-w-sm border-[#ccb385] dark:border-[#423321] !bg-white !dark:bg-[#1e1710] p-5 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#4a3615] dark:text-[#f0e3ce]">Your Stats</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{streak}</span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e]">Day Streak</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{completedCount}</span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e]">Mastered</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{state.recallAttempts}</span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e]">Total Attempts</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321]">
              <span className="text-2xl font-bold text-[#8f6422] dark:text-[#d4aa61]">
                {state.recallAttempts > 0 ? Math.round((state.recallWins / state.recallAttempts) * 100) : 0}%
              </span>
              <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e]">Win Rate</span>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <button
              onClick={handleImportBackup}
              className="flex-1 flex justify-center items-center gap-2 rounded-xl border border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#1e1710] px-4 py-2 text-xs font-semibold text-[#5c482a]"
            >
              <Upload className="h-4 w-4" /> Import
            </button>
            <button
              onClick={handleExportBackup}
              className="flex-1 flex justify-center items-center gap-2 rounded-xl border border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#1e1710] px-4 py-2 text-xs font-semibold text-[#5c482a]"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
