"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SHLOKAS } from "@/lib/shlokas";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShlokaCard } from "@/components/shloka-card";
import { AudioPlayer } from "@/components/audio-player";
import { LoaderQuote } from "@/components/loader-quote";
import { LoginScreen } from "@/components/login-screen";
import { DialogCard } from "@/components/dialog-card";
import { AudioErrorBoundary } from "@/components/audio-error-boundary";
import { OfflineLibrary } from "@/components/offline-library";
import { VerseStudy } from "@/components/verse-study";
import { ReviewQueue } from "@/components/review-queue";
import { LinePractice } from "@/components/line-practice";
import { StudyTools } from "@/components/study-tools";
import { GuidedPractice } from "@/components/guided-practice";
import { VersePicker } from "@/components/verse-picker";
import { SaveStatus } from "@/components/save-status";
import { useLearning } from "@/components/learning-provider";
import { useAllVerses } from "@/hooks/use-all-verses";
import type { GitaVerse } from "@/lib/gita-verses";
import { AUDIO_TRANSPORT_EVENT } from "@/lib/line-practice";

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
  const { verses: allVerses, failed, retry } = useAllVerses(ready);
  const current: GitaVerse = readAll && readingVerse ? readingVerse : { ...active, important: true };
  const readingIndex = allVerses?.findIndex((v) => v.id === current.id) ?? -1;

  useEffect(() => {
    if (!ready) return;
    const id = new URL(window.location.href).searchParams.get("verse");
    if (id && SHLOKAS.some((v) => v.id === id)) goToShloka(id);
  }, [ready, goToShloka]);

  const navigate = useCallback((delta: number) => {
    if (readAll) {
      if (!allVerses) return;
      const index = allVerses.findIndex((v) => v.id === (readingVerse?.id ?? active.id));
      const target = index >= 0 ? allVerses[index + delta] : undefined;
      if (target) setReadingVerse(target);
    } else if (delta > 0) next(); else prev();
    window.scrollTo({ top: 0 });
  }, [readAll, allVerses, readingVerse?.id, active.id, next, prev]);

  const jumpToLearn = useCallback((id: string) => { setReadAll(false); setReadingVerse(null); goToShloka(id); window.scrollTo({ top: 0 }); }, [goToShloka]);
  function pick(verse: GitaVerse) {
    if (readAll || !verse.important) { setReadAll(true); setReadingVerse(verse); }
    else jumpToLearn(verse.id);
    window.scrollTo({ top: 0 });
  }

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
          <button className="icon-button theme-button" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
          <a href="/profile" className="icon-button profile-avatar" aria-label="Open profile"><span aria-hidden="true">{profile.displayName.charAt(0).toUpperCase()}</span></a>
        </div>
      </header>
      <div className="reader-toolbar">
        <div className="mode-switch" role="group" aria-label="Reading collection">
          <button aria-pressed={!readAll} onClick={() => { setReadAll(false); setReadingVerse(null); }}>Learn 108</button>
          <button aria-pressed={readAll} onClick={() => { setReadingVerse(allVerses?.find((v) => v.id === active.id) ?? { ...active, important: true }); setReadAll(true); }}>Read all</button>
        </div>
        <VersePicker current={current} verses={allVerses} favorites={profile.profile.favorites} completed={state.completed} failed={failed} onRetry={retry} onPick={pick} />
      </div>
      {!readAll && <ReviewQueue hideWhenEmpty due={dueReviews} reviews={state.reviews} onRate={rateRecall} onJump={jumpToLearn} />}
      {learnedToday >= dailyGoal && !keepReading && <aside className="session-complete" role="status"><p className="font-semibold">Today’s practice is complete.</p><p className="study-muted mt-1 text-sm">Rest here, or stay with the verses a little longer.</p><div className="mt-3 flex flex-wrap gap-2"><button className="study-button" onClick={() => setKeepReading(true)}>Keep reading</button><a className="study-button" href="/profile">Finish for today</a></div></aside>}
      <ShlokaCard verse={current} contentMode={state.contentMode} setContentMode={setContentMode} isFavorite={profile.isFavorite(current.id)} onToggleFavorite={() => profile.toggleFavorite(current.id)} isFirst={readAll ? readingIndex <= 0 : isFirst} isLast={readAll ? !allVerses || readingIndex >= allVerses.length - 1 : isLast} onNext={() => navigate(1)} onPrev={() => navigate(-1)} />
      {!readAll && <GuidedPractice key={active.id} verse={active} progress={activeProgress} audioRef={audioRef} onStep={markStep} onRecall={completeRecall} onContentMode={setContentMode} onKnown={() => setConfirmKnown(true)} onUndo={() => undoLearnedForActive(active.id)} />}
      {current.important ? <StudyTools onClose={() => { window.dispatchEvent(new Event(AUDIO_TRANSPORT_EVENT)); audioRef.current?.pause(); }}>
        <LinePractice key={current.id} shloka={current} audioRef={audioRef} cues={profile.profile.lineCues[current.id]} onSave={(cues) => profile.setLineCues(current.id, cues)} onActiveChange={setLinePracticeActive} />
        <VerseStudy shloka={current} />
        <OfflineLibrary reference={current.reference} />
      </StudyTools> : <p className="study-muted py-4 text-sm">Audio and memorization tools are available for the selected 108 verses.</p>}
      {(storageError || syncStatus === "error" || !online) && <SaveStatus status={syncStatus} storageError={storageError} online={online} onRetry={retrySave} />}
    </div>
    {current.important && <AudioErrorBoundary><AudioPlayer audioSrc={`/audio/${current.reference}.mp3`} elementRef={audioRef} linePracticeActive={linePracticeActive} title={`Chapter ${current.chapter} · Verse ${current.reference.split(".")[1]}`} isFirst={readAll ? readingIndex <= 0 : isFirst} isLast={readAll ? !allVerses || readingIndex >= allVerses.length - 1 : isLast} audioAvailable={audioAvailable} setAudioAvailable={setAudioAvailable} onNext={() => navigate(1)} onPrev={() => navigate(-1)} /></AudioErrorBoundary>}
    <Dialog open={confirmKnown} onOpenChange={setConfirmKnown}><DialogCard>
      <DialogHeader><DialogTitle>Mark verse {active.reference} as learned?</DialogTitle><DialogDescription>Use this shortcut for a verse you already know. It completes all four steps, adds tomorrow’s review, and opens the next verse.</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2"><button className="study-button" onClick={() => setConfirmKnown(false)}>Cancel</button><button className="study-button study-primary" onClick={() => { setConfirmKnown(false); markAsLearned(active.id); window.scrollTo({ top: 0 }); }}>Mark learned</button></div>
    </DialogCard></Dialog>
  </main>;
}
