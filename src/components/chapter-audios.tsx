"use client";
import type { CSSProperties } from "react";
import { AlertCircle, AudioLines, BookOpen, ChevronRight, Gauge, ListMusic, Loader2, Moon, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from "lucide-react";
import { chapterProgress, formatLength, resumeAt, sleepLabel } from "@/lib/chapter-audio";
import { formatTime } from "@/lib/audio-playback";
import { SKIP_S, useChapterAudio } from "@/components/chapter-audio-provider";
import { ChapterArt } from "@/components/chapter-art";
import { PageHeader } from "@/components/page-header";
import { ChapterBriefPanel } from "@/components/chapter-brief";

/** The "All Chapter Audios" screen: a full-screen player and the chapter list. Playback itself lives in ChapterAudioProvider. */
export function ChapterAudios() {
  const audio = useChapterAudio();
  const { chapters, chapter, prev, next, positions, playing, loading, position, duration, rate, error, sleep, ready, view, setView, toggle, seek, choose, cycleRate, cycleSleep } = audio;
  if (!chapter) return <main id="main-content" className="inner-page"><p className="study-muted p-6 text-center text-sm" role="status">No chapter audio is available yet.</p></main>;
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  const busy = playing || loading;

  if (view === "player") return <main id="main-content" className="chapter-stage">
    <PageHeader title="Now playing" className="chapter-stage-bar" action={<button className="icon-button" aria-label="All chapters" onClick={() => setView("list")}><ListMusic className="h-5 w-5" /></button>} />
    <div className="chapter-stage-body">
      <div className="chapter-art-wrap"><ChapterArt chapter={chapter.chapter} className="chapter-art-large" /></div>
      <div className="chapter-stage-title">
        <p className="eyebrow">Chapter {chapter.chapter} · {formatLength(chapter.seconds)}</p>
        <h2 className="font-serif">{chapter.title}</h2>
        <p className="study-muted">{chapter.meaning}</p>
      </div>
      <div className="chapter-seek-wrap">
        <input className="chapter-seek" type="range" min={0} max={duration || 1} step={0.5} value={Math.min(position, duration || 1)} style={{ "--pct": `${pct}%` } as CSSProperties}
          aria-label="Audio position" aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`} disabled={!ready || !duration} onChange={(e) => seek(Number(e.target.value))} />
        <div className="chapter-times tabular-nums"><span>{formatTime(position)}</span><span>-{formatTime(Math.max(0, duration - position))}</span></div>
      </div>
      <div className="chapter-controls">
        <button className="icon-button" aria-label={`Back ${SKIP_S} seconds`} onClick={() => seek(position - SKIP_S)}><RotateCcw className="h-6 w-6" /></button>
        <button className="icon-button" aria-label="Previous chapter" disabled={!prev} onClick={() => choose(prev, busy)}><SkipBack className="h-7 w-7" /></button>
        <button className="player-play chapter-play" aria-label={error ? "Retry audio" : loading ? "Cancel loading" : playing ? "Pause audio" : "Play audio"} onClick={toggle} disabled={!ready}>
          {error ? <AlertCircle className="h-8 w-8" /> : loading ? <Loader2 className="h-8 w-8 animate-spin" /> : playing ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 translate-x-0.5 fill-current" />}
        </button>
        <button className="icon-button" aria-label="Next chapter" disabled={!next} onClick={() => choose(next, busy)}><SkipForward className="h-7 w-7" /></button>
        <button className="icon-button" aria-label={`Forward ${SKIP_S} seconds`} onClick={() => seek(position + SKIP_S)}><RotateCw className="h-6 w-6" /></button>
      </div>
      {error && <p className="text-center text-sm" role="alert">{error}</p>}
      <div className="chapter-actions">
        <button className="chapter-action" onClick={cycleRate} aria-label={`Playback speed ${rate}x`}><Gauge className="h-4 w-4" aria-hidden="true" />{rate}x</button>
        <button className="chapter-action" onClick={cycleSleep} aria-pressed={!!sleep} aria-label={sleep ? `Sleep timer: ${sleepLabel(sleep, Date.now())}. Tap to change` : "Sleep timer off. Tap to set"}><Moon className="h-4 w-4" aria-hidden="true" />{sleepLabel(sleep, Date.now())}</button>
        <button className="chapter-action" onClick={() => document.getElementById("chapter-brief")?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label="Read the chapter brief"><BookOpen className="h-4 w-4" aria-hidden="true" />Brief</button>
      </div>
      {next ? <button className="chapter-up-next" onClick={() => choose(next, busy)}>
        <ChapterArt chapter={next.chapter} className="chapter-art-small" />
        <span className="min-w-0 flex-1 text-left"><span className="eyebrow block">Up next · Chapter {next.chapter}</span><span className="block truncate text-sm font-semibold">{next.title}</span></span>
        <ChevronRight className="h-5 w-5 shrink-0 opacity-60" aria-hidden="true" />
      </button> : <button className="chapter-up-next" onClick={() => setView("list")}><span className="flex-1 text-left text-sm font-semibold">Last chapter · see all chapters</span><ChevronRight className="h-5 w-5 opacity-60" aria-hidden="true" /></button>}
    </div>
    <ChapterBriefPanel chapter={chapter.chapter} />
  </main>;

  return <main id="main-content" className="inner-page chapter-list-page">
    <PageHeader title="All Chapter Audios" />
    <div className="reading-shell">
      <p className="study-muted mb-3 text-sm">Tamil narration of all {chapters.length} chapters. Your place in each chapter is saved.</p>
      <ol className="chapter-list">
        {chapters.map((c) => {
          const current = c.chapter === chapter.chapter;
          const done = chapterProgress(positions, c.chapter, c.seconds);
          const left = done ? formatLength(Math.max(60, c.seconds - resumeAt(positions, c.chapter))) : "";
          return <li key={c.chapter}><button className="chapter-row" aria-current={current ? "true" : undefined} onClick={() => { choose(c, true); setView("player"); }}>
            <span className="chapter-row-art">
              <ChapterArt chapter={c.chapter} className="chapter-art-small" />
              {current && busy && <span className="chapter-row-playing"><AudioLines className="h-5 w-5" aria-hidden="true" /></span>}
            </span>
            <span className="chapter-row-text">
              <span className="chapter-row-title">{c.title}{current && <span className="sr-only">{busy ? " (playing)" : " (selected)"}</span>}</span>
              <span className="chapter-row-meaning">{c.meaning}</span>
              {done > 0 && <span className="chapter-row-progress" aria-hidden="true"><span style={{ width: `${done}%` }} /></span>}
            </span>
            <span className="chapter-row-meta tabular-nums">{done ? `${left} left` : formatLength(c.seconds)}</span>
          </button></li>;
        })}
      </ol>
    </div>
  </main>;
}
