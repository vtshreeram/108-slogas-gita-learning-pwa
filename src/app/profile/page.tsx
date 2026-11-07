/* eslint-disable @next/next/no-html-link-for-pages -- Document navigation allows the service worker to serve cached route HTML offline. */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { ArrowLeft, Download, Upload, LogOut, Star, BookOpen } from "lucide-react";
import { useLearning } from "@/components/learning-provider";
import { LoginScreen } from "@/components/login-screen";
import { LoaderQuote } from "@/components/loader-quote";
import { SaveStatus } from "@/components/save-status";
import { ReviewQueue } from "@/components/review-queue";
import { useBackupRestore } from "@/hooks/use-backup-restore";
import { SHLOKAS, TOTAL_SHLOKAS } from "@/lib/shlokas";
import { fullDone } from "@/lib/constants";

export default function ProfilePage() {
  const { session, learner, profile } = useLearning();
  const { user, checking, signIn, signOut } = session;
  const { ready, state, completedCount, completedShlokas, streak, winRatePct, learnedToday, dailyGoal, progressPct, dueReviews, rateRecall, goToShloka, setActiveMode, syncStatus, storageError, online, retrySave } = learner;
  const { displayName, setCustomName } = profile;
  const backup = useBackupRestore(user?.uid ?? null);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [collection, setCollection] = useState<"learned" | "favorites">("learned");
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const favorites = SHLOKAS.filter((v) => profile.isFavorite(v.id));
  const verses = collection === "learned" ? completedShlokas : favorites;
  const joined = state.startedAt ? new Date(`${state.startedAt}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Today";
  const badges = [
    ...(completedCount >= 1 ? ["First verse learned"] : []),
    ...(completedCount >= 10 ? ["10 verses learned"] : []),
    ...(completedCount >= 25 ? ["25 verses learned"] : []),
    ...(completedCount >= 50 ? ["50 verses learned"] : []),
    ...(completedCount >= 75 ? ["75 verses learned"] : []),
    ...(completedCount === TOTAL_SHLOKAS ? ["All 108 learned"] : []),
    ...(streak >= 7 ? ["7-day practice streak"] : []),
    ...(streak >= 30 ? ["30-day practice streak"] : []),
  ];

  if (checking || (user && !ready)) return <LoaderQuote />;
  if (!user) return <LoginScreen onSignIn={signIn} />;

  async function logout() {
    setSigningOut(true); setSignOutError("");
    try { await signOut(); router.replace("/"); }
    catch { setSignOutError("Could not sign out. Please try again."); setSigningOut(false); }
  }

  return <main id="main-content" className="profile-page">
    <div className="reading-shell">
      <header className="app-header"><a className="study-button" href="/"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to reading</a><span className="eyebrow">Your practice</span></header>
      <section className="profile-intro">
        <div className="profile-initial" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</div>
        <h1 className="font-serif text-3xl">Your profile</h1>
        {editing ? <form className="my-3 space-y-3" onSubmit={(e) => { e.preventDefault(); setCustomName(name); setEditing(false); }}><label htmlFor="display-name" className="block text-sm">Display name</label><input id="display-name" className="study-input w-full" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus /><div className="flex gap-2"><button className="study-button study-primary" type="submit">Save name</button><button className="study-button" type="button" onClick={() => setEditing(false)}>Cancel</button></div></form> : <div className="mt-2 flex flex-wrap items-center gap-2"><p className="font-semibold">{displayName}</p><button className="text-action" onClick={() => { setName(displayName); setEditing(true); }}>Edit name</button></div>}
        <p className="study-muted break-words text-sm">{user.email}</p><p className="study-muted mt-2 text-sm">Practicing since {joined}</p>
      </section>
      <section className="profile-section" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="section-title">Your learning journey</h2>
        <p className="mt-3 text-lg"><strong>{completedCount}</strong> of {TOTAL_SHLOKAS} verses learned <span className="study-muted">· {progressPct}%</span></p>
        <progress className="learning-progress mt-3 w-full" value={completedCount} max={TOTAL_SHLOKAS} aria-label="Verses learned" />
        <dl className="profile-stats">
          <div><dt>Today’s goal</dt><dd>{learnedToday} / {dailyGoal}</dd></div><div><dt>Day streak</dt><dd>{streak}</dd></div>
          <div><dt>Recall success</dt><dd>{state.recallAttempts ? `${winRatePct}%` : "No attempts yet"}</dd></div><div><dt>Recall attempts</dt><dd>{state.recallAttempts}</dd></div>
        </dl>
        <p className="study-muted text-sm">Recall success is based on your self-assessments. Marking a known verse learned does not count as a recall attempt.</p>
        {badges.length > 0 && <ul className="mt-4 flex flex-wrap gap-2" aria-label="Achievements">{badges.map((badge) => <li className="achievement" key={badge}>{badge}</li>)}</ul>}
      </section>
      <ReviewQueue due={dueReviews} reviews={state.reviews} onRate={rateRecall} onJump={(id) => { goToShloka(id); router.push(`/?verse=${id}`); }} />
      <section className="profile-section" aria-labelledby="library-heading">
        <h2 id="library-heading" className="section-title">Your verse library</h2>
        <div className="mode-switch my-4" role="group" aria-label="Your verse library"><button aria-pressed={collection === "learned"} onClick={() => setCollection("learned")}><BookOpen className="h-4 w-4" aria-hidden="true" />Learned ({completedCount})</button><button aria-pressed={collection === "favorites"} onClick={() => setCollection("favorites")}><Star className="h-4 w-4" aria-hidden="true" />Favorites ({favorites.length})</button></div>
        {verses.length ? <ul className="divide-y divide-[var(--study-border)]">{verses.map((verse) => <li key={verse.id}><a href={`/?verse=${verse.id}`} className="verse-result"><span className="font-semibold">Verse {verse.reference}</span><span lang="sa-Latn" className="study-muted block text-sm">{verse.transliteration.split("\n")[0]}</span></a></li>)}</ul> : <p className="study-muted py-4 text-sm">{collection === "learned" ? "Your learned verses will appear here after practice." : "Tap the star beside a selected verse to save it here."}</p>}
      </section>
      <section className="profile-section" aria-labelledby="preferences-heading">
        <h2 id="preferences-heading" className="section-title">Practice preferences</h2>
        <fieldset className="mt-4"><legend className="mb-2 text-sm font-semibold">Daily pace</legend><div className="flex flex-wrap gap-3">{(["normal", "lite"] as const).map((mode) => <label key={mode} className="pace-option"><input type="radio" name="pace" value={mode} checked={state.activeMode === mode} onChange={() => setActiveMode(mode)} /><span>{mode === "normal" ? "Normal · 2 verses a day" : "Lite · 1 verse a day"}</span></label>)}</div></fieldset>
        <label htmlFor="theme" className="mt-5 block text-sm font-semibold">Appearance</label><select id="theme" className="study-input mt-2" value={theme ?? "system"} onChange={(e) => setTheme(e.target.value)}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select>
      </section>
      <section className="profile-section" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="section-title">Saved progress & backups</h2>
        <div className="my-4"><SaveStatus status={syncStatus} storageError={storageError} online={online} onRetry={retrySave} /></div>
        <p className="study-muted text-sm">A backup includes learned verses, review dates, favorites, your name, and line timings.</p>
        <div className="mt-4 flex flex-wrap gap-2"><button className="study-button" onClick={backup.handleExportBackup}><Download className="h-4 w-4" aria-hidden="true" />Export backup</button><button className="study-button" onClick={backup.handleImportBackup}><Upload className="h-4 w-4" aria-hidden="true" />Import backup</button></div>
        {backup.message && <p className="mt-3 text-sm" role="status">{backup.message}</p>}
        {backup.candidate && <section className="study-panel mt-4" aria-label="Backup preview"><h3 className="font-semibold">Restore this backup?</h3><p className="my-2 text-sm">{Object.values(backup.candidate.progress.completed).filter(fullDone).length} learned verses · {backup.candidate.profile ? `${backup.candidate.profile.favorites.length} favorites` : "Progress-only backup; your favorites will stay"}</p><p className="study-muted text-sm">Merge keeps completed steps from both copies. Replace uses the backup’s progress. A recovery copy is saved first.</p><div className="mt-3 flex flex-wrap gap-2"><button className="study-button study-primary" onClick={() => backup.confirmRestore("merge")}>Merge backup</button><button className="study-button" onClick={() => backup.confirmRestore("replace")}>Replace progress</button><button className="study-button" onClick={backup.cancelRestore}>Cancel</button></div></section>}
      </section>
      <footer className="py-6"><button className="study-button" disabled={signingOut} onClick={() => void logout()}><LogOut className="h-4 w-4" aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button>{signOutError && <p role="alert" className="mt-3 text-sm">{signOutError}</p>}</footer>
    </div>
  </main>;
}
