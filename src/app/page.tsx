"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Headphones, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SHLOKAS } from "@/lib/shlokas";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShlokaCard } from "@/components/shloka-card";
import { AudioPlayer } from "@/components/audio-player";
import { LoaderQuote } from "@/components/loader-quote";
import { LoginScreen } from "@/components/login-screen";
import { DialogCard } from "@/components/dialog-card";
import { AudioErrorBoundary } from "@/components/audio-error-boundary";
import { ReviewQueue } from "@/components/review-queue";
import { StudyTools } from "@/components/study-tools";
import { GuidedPractice } from "@/components/guided-practice";
import { VersePicker } from "@/components/verse-picker";
import { SaveStatus } from "@/components/save-status";
import { useLearning } from "@/components/learning-provider";
import { loadChapter, type GitaVerse } from "@/lib/gita-verses";
import { VERSE_INDEX, indexOfReference } from "@/lib/verse-index";
import { AUDIO_TRANSPORT_EVENT } from "@/lib/line-practice";

const SHLOKA_BY_REFERENCE = new Map(SHLOKAS.map((s) => [s.reference, s]));

// Line practice, verse study and offline downloads load as their own chunk, when first opened (and at idle afterwards, so they also work offline).
const loadStudyPanels = () => import("@/components/study-panels").then((m) => m.StudyPanels);
const StudyPanels = dynamic(loadStudyPanels, { loading: () => <p role="status" className="study-muted text-sm">Loading tools…</p> });

type NavStatus = { state: "idle" | "loading" | "error"; message?: string; retryIndex?: number };

export default function Home() {
  const { session, learner, profile } = useLearning();
  const { user, checking, signIn } = session;
  const { resolvedTheme, setTheme } = useTheme();
  const { ready, state, active, activeProgress, markStep, completeRecall, markAsLearned, undoLearnedForActive, goToShloka, next, prev, setContentMode, dailyGoal, learnedToday, dueReviews, rateRecall, isFirst, isLast, syncStatus, storageError, online, retrySave } = learner;
  const [readAll, setReadAll] = useState(false);
  const [readingVerse, setReadingVerse] = useState<GitaVerse | null>(null);
  const [confirmKnown, setConfirmKnown] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [linePracticeActive, setLinePracticeActive] = useState(false);
  const [keepReading, setKeepReading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [navStatus, setNavStatus] = useState<NavStatus>({ state: "idle" });
  const requestSeq = useRef(0);
  /** Index (in all 657) of the verse most recently asked for, so rapid steps keep moving forward from it. */
  const lastRequested = useRef<number | null>(null);
  const current: GitaVerse = readAll && readingVerse ? readingVerse : { ...active, important: true };
  const readingIndex = indexOfReference(current.reference);
  const readFirst = readingIndex <= 0;
  const readLast = readingIndex >= VERSE_INDEX.length - 1;

  useEffect(() => {
    if (!ready) return;
    const id = new URL(window.location.href).searchParams.get("verse");
    if (id && SHLOKAS.some((v) => v.id === id)) goToShloka(id);
  }, [ready, goToShloka]);

  /** Read-all: open entry `index` of the 657. The 108 are already in the bundle; any other verse downloads only its own chapter. */
  const openVerse = useCallback(async (index: number) => {
    const entry = VERSE_INDEX[index];
    if (!entry) return;
    const seq = ++requestSeq.current;
    lastRequested.current = index;
    setReadAll(true);
    const local = entry.important ? SHLOKA_BY_REFERENCE.get(entry.reference) : undefined;
    if (local) { setReadingVerse({ ...local, important: true }); setNavStatus({ state: "idle" }); return; }
    setNavStatus({ state: "loading" });
    try {
      const verse = (await loadChapter(entry.chapter)).find((v) => v.reference === entry.reference);
      if (seq !== requestSeq.current) return; // the learner has already moved on
      if (!verse) throw new Error("This verse is not available yet.");
      setReadingVerse(verse); setNavStatus({ state: "idle" });
    } catch (error) {
      if (seq === requestSeq.current) setNavStatus({ state: "error", message: error instanceof Error ? error.message : "Could not open this verse.", retryIndex: index });
    }
  }, []);

  const navigate = useCallback((delta: number) => {
    if (readAll) {
      const from = lastRequested.current ?? indexOfReference(readingVerse?.reference ?? active.reference);
      if (from >= 0) void openVerse(from + delta);
    } else if (delta > 0) next(); else prev();
    window.scrollTo({ top: 0 });
  }, [readAll, readingVerse?.reference, active.reference, openVerse, next, prev]);

  const leaveReading = useCallback(() => { requestSeq.current++; lastRequested.current = null; setReadAll(false); setReadingVerse(null); setNavStatus({ state: "idle" }); }, []);
  const jumpToLearn = useCallback((id: string) => { leaveReading(); goToShloka(id); window.scrollTo({ top: 0 }); }, [goToShloka, leaveReading]);
  function pick(index: number) {
    const entry = VERSE_INDEX[index];
    const learnId = entry?.important ? SHLOKA_BY_REFERENCE.get(entry.reference)?.id : undefined;
    if (!readAll && learnId) jumpToLearn(learnId);
    else void openVerse(index);
    window.scrollTo({ top: 0 });
  }

  // Once the app is idle and the service worker controls the page, fetch the tools chunk so it is saved for offline use.
  useEffect(() => {
    if (!ready || !("serviceWorker" in navigator) || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    let cancelled = false;
    const warm = () => { if (!cancelled) void loadStudyPanels(); };
    const idle = () => { if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 5000 }); else setTimeout(warm, 3000); };
    const whenControlled = () => { if (navigator.serviceWorker.controller) idle(); else navigator.serviceWorker.addEventListener("controllerchange", idle, { once: true }); };
    void navigator.serviceWorker.ready.then(() => { if (!cancelled) whenControlled(); });
    return () => { cancelled = true; navigator.serviceWorker.removeEventListener("controllerchange", idle); };
  }, [ready]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('[role="dialog"]') || (event.target instanceof Element && event.target.closest('input,textarea,select,button,a,summary,[contenteditable="true"]'))) return;
      if (event.key === "ArrowRight") { event.preventDefault(); navigate(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); navigate(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (checking || (user && !ready)) return <LoaderQuote />;
  if (!user) return <LoginScreen onSignIn={signIn} />;

  return <main id="main-content" className="reading-page">
    <div className="reading-shell">
      <header className="app-header">
        <div className="brand-link"><span className="brand-symbol" aria-hidden="true">ॐ</span><div><h1>Bhagavad Gita</h1><p className="brand-caption">Read. Reflect. Remember.</p></div></div>
        <div className="header-actions">
          <VersePicker current={current} favorites={profile.profile.favorites} completed={state.completed} onPick={pick} />
          <button className="icon-button theme-button" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
          <a href="/profile" className="icon-button profile-avatar" aria-label="Open profile"><span aria-hidden="true">{profile.displayName.charAt(0).toUpperCase()}</span></a>
        </div>
      </header>
      <div className="reader-toolbar">
        <div className="mode-switch" role="group" aria-label="Reading collection">
          <button aria-pressed={!readAll} onClick={leaveReading}>Learn 108</button>
          <button aria-pressed={readAll} onClick={() => { requestSeq.current++; lastRequested.current = null; setReadingVerse({ ...active, important: true }); setReadAll(true); }}>Read all</button>
        </div>
        <a className="study-button" href="/chapters"><Headphones className="h-4 w-4" aria-hidden="true" />All Chapter Audios</a>
      </div>
      {!readAll && <ReviewQueue hideWhenEmpty due={dueReviews} reviews={state.reviews} onRate={rateRecall} onJump={jumpToLearn} />}
      {learnedToday >= dailyGoal && !keepReading && <aside className="session-complete" role="status"><p className="font-semibold">Today’s practice is complete.</p><p className="study-muted mt-1 text-sm">Rest here, or stay with the verses a little longer.</p><div className="mt-3 flex flex-wrap gap-2"><button className="study-button" onClick={() => setKeepReading(true)}>Keep reading</button><a className="study-button" href="/profile">Finish for today</a></div></aside>}
      {readAll && navStatus.state === "loading" && <p className="study-muted text-sm" role="status">Opening verse…</p>}
      {readAll && navStatus.state === "error" && <p className="text-sm" role="alert">{navStatus.message} <button className="underline underline-offset-4" onClick={() => void openVerse(navStatus.retryIndex ?? 0)}>Try again</button></p>}
      <ShlokaCard verse={current} contentMode={state.contentMode} setContentMode={setContentMode} isFavorite={profile.isFavorite(current.id)} onToggleFavorite={() => profile.toggleFavorite(current.id)} isFirst={readAll ? readFirst : isFirst} isLast={readAll ? readLast : isLast} onNext={() => navigate(1)} onPrev={() => navigate(-1)} />
      {!readAll && <GuidedPractice key={active.id} verse={active} progress={activeProgress} audioRef={audioRef} onStep={markStep} onRecall={completeRecall} onContentMode={setContentMode} onKnown={() => setConfirmKnown(true)} onUndo={() => undoLearnedForActive(active.id)} />}
      {current.important ? <StudyTools onClose={() => { window.dispatchEvent(new Event(AUDIO_TRANSPORT_EVENT)); audioRef.current?.pause(); }}>
        <StudyPanels active={current} audioRef={audioRef} cues={profile.profile.lineCues[current.id]} onSaveCues={(cues) => profile.setLineCues(current.id, cues)} onLinePracticeActive={setLinePracticeActive} />
      </StudyTools> : <p className="study-muted py-4 text-sm">Audio and memorization tools are available for the selected 108 verses.</p>}
      {(storageError || syncStatus === "error" || !online) && <SaveStatus status={syncStatus} storageError={storageError} online={online} onRetry={retrySave} />}
    </div>
    {current.important && <AudioErrorBoundary><AudioPlayer audioSrc={`/audio/${current.reference}.mp3`} elementRef={audioRef} linePracticeActive={linePracticeActive} title={`Chapter ${current.chapter} · Verse ${current.reference.split(".")[1]}`} isFirst={readAll ? readFirst : isFirst} isLast={readAll ? readLast : isLast} audioAvailable={audioAvailable} setAudioAvailable={setAudioAvailable} onNext={() => navigate(1)} onPrev={() => navigate(-1)} /></AudioErrorBoundary>}
    <Dialog open={confirmKnown} onOpenChange={setConfirmKnown}><DialogCard>
      <DialogHeader><DialogTitle>Mark verse {active.reference} as learned?</DialogTitle><DialogDescription>Use this shortcut for a verse you already know. It completes all four steps, adds tomorrow’s review, and opens the next verse.</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2"><button className="study-button" onClick={() => setConfirmKnown(false)}>Cancel</button><button className="study-button study-primary" onClick={() => { setConfirmKnown(false); markAsLearned(active.id); window.scrollTo({ top: 0 }); }}>Mark learned</button></div>
    </DialogCard></Dialog>
  </main>;
}
