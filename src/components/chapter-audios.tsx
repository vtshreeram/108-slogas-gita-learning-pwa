/* eslint-disable @next/next/no-html-link-for-pages -- Document navigation allows the service worker to serve cached route HTML offline. */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, ChevronDown, Gauge, ListMusic, Loader2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, AlertCircle } from "lucide-react";
import { CHAPTER_AUDIO, chapterAudioUrl, formatLength, neighbour, parsePositions, resumeAt, withPosition, type ChapterAudio, type Positions } from "@/lib/chapter-audio";
import { SPEED_OPTIONS, cycleOption, formatTime } from "@/lib/audio-playback";
import { mediaPosition } from "@/components/audio-player";

const SAVE_EVERY_S = 5;
const SKIP_S = 15;
const readStore = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStore = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* resume is a convenience */ } };

/** Parchment "cover" for a chapter; there is no album art, so the numeral carries the identity. */
function Art({ chapter, className = "" }: { chapter: number; className?: string }) {
  return <div className={`chapter-art ${className}`} style={{ "--h": 30 + ((chapter * 7) % 26) } as React.CSSProperties} aria-hidden="true"><span className="chapter-art-om">ॐ</span><span className="chapter-art-no">{chapter}</span></div>;
}

export function ChapterAudios({ uid }: { uid: string }) {
  const chapters = CHAPTER_AUDIO;
  const positionsKey = `gita-chapter-audio-v1:${uid}`;
  const lastKey = `gita-chapter-audio-last:${uid}`;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const positions = useRef<Positions>({});
  const lastSaved = useRef(0);
  const autoplay = useRef(false);
  const [chapter, setChapter] = useState<ChapterAudio | undefined>(chapters[0]);
  const [view, setView] = useState<"player" | "list">("player");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);

  // Restore the last chapter and every saved position once, on the client.
  useEffect(() => {
    positions.current = parsePositions(readStore(positionsKey));
    const last = Number(readStore(lastKey));
    const found = chapters.find((c) => c.chapter === last);
    if (found) setChapter(found);
    setRestored(true);
  }, [positionsKey, lastKey, chapters]);

  const persist = useCallback((seconds: number, total: number) => {
    if (!chapter) return;
    positions.current = withPosition(positions.current, chapter.chapter, seconds, total);
    writeStore(positionsKey, JSON.stringify(positions.current));
    writeStore(lastKey, String(chapter.chapter));
  }, [chapter, positionsKey, lastKey]);
  useEffect(() => {
    const save = () => { const a = audioRef.current; if (a && chapter && a.currentTime) persist(a.currentTime, Number.isFinite(a.duration) ? a.duration : 0); };
    window.addEventListener("pagehide", save);
    return () => { save(); window.removeEventListener("pagehide", save); };
  }, [chapter, persist]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    try { setError(""); setLoading(true); if (audio.error) audio.load(); await audio.play(); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setLoading(false); setPlaying(false); setError("Playback did not start. Tap Play to try again."); }
  }, []);
  const pause = useCallback(() => { audioRef.current?.pause(); setLoading(false); }, []);
  const seek = useCallback((to: number) => { const a = audioRef.current; if (!a) return; const clamped = Math.max(0, Math.min(to, Number.isFinite(a.duration) ? a.duration : to)); a.currentTime = clamped; setPosition(clamped); mediaPosition(a); }, []);

  const choose = useCallback((next: ChapterAudio | undefined, startPlaying: boolean) => {
    if (!next) return;
    const a = audioRef.current;
    if (a && chapter && a.currentTime) persist(a.currentTime, Number.isFinite(a.duration) ? a.duration : 0);
    autoplay.current = startPlaying;
    setError(""); setPosition(0); setDuration(next.seconds); setPlaying(false); setLoading(startPlaying);
    setChapter(next);
  }, [chapter, persist]);
  const prev = neighbour(chapters, chapter?.chapter ?? 0, -1);
  const next = neighbour(chapters, chapter?.chapter ?? 0, 1);
  const toggle = useCallback(() => { if (playing || loading) pause(); else void play(); }, [playing, loading, pause, play]);

  useEffect(() => { if (audioRef.current) { audioRef.current.playbackRate = rate; mediaPosition(audioRef.current); } }, [rate, chapter]);
  useEffect(() => {
    if (!chapter || !("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: `Chapter ${chapter.chapter} · ${chapter.title}`, artist: "Bhagavad Gita", album: "All chapters", artwork: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }] });
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", () => void play()], ["pause", pause],
      ["previoustrack", prev ? () => choose(prev, true) : null], ["nexttrack", next ? () => choose(next, true) : null],
      ["seekbackward", () => seek((audioRef.current?.currentTime ?? 0) - SKIP_S)], ["seekforward", () => seek((audioRef.current?.currentTime ?? 0) + SKIP_S)],
      ["seekto", (d) => { if (typeof d.seekTime === "number") seek(d.seekTime); }],
    ];
    for (const [action, handler] of handlers) { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* optional browser capability */ } }
    return () => { for (const [action] of handlers) { try { navigator.mediaSession.setActionHandler(action, null); } catch { /* optional */ } } };
  }, [chapter, prev, next, play, pause, choose, seek]);
  useEffect(() => { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused"; }, [playing]);

  const src = useMemo(() => (chapter && restored ? chapterAudioUrl(chapter.key) : undefined), [chapter, restored]);
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  if (!chapter) return <p className="study-muted p-6 text-center text-sm" role="status">No chapter audio is available yet.</p>;
  const label = `Chapter ${chapter.chapter}`;

  const PlayIcon = !error ? (loading ? <Loader2 className="h-7 w-7 animate-spin" /> : playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />) : <AlertCircle className="h-7 w-7" />;

  return <>
    <audio ref={audioRef} src={src} preload="metadata"
      onLoadedMetadata={(e) => { const a = e.currentTarget; setDuration(Number.isFinite(a.duration) ? a.duration : chapter.seconds); const at = resumeAt(positions.current, chapter.chapter); if (at && at < a.duration) { a.currentTime = at; setPosition(at); } mediaPosition(a); }}
      onWaiting={() => setLoading(true)} onCanPlay={() => { setLoading(false); if (autoplay.current) { autoplay.current = false; void play(); } }}
      onPlay={(e) => { setPlaying(true); setLoading(false); mediaPosition(e.currentTarget); }} onPause={(e) => { setPlaying(false); const a = e.currentTarget; persist(a.currentTime, a.duration); mediaPosition(a); }}
      onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; setPosition(t); if (Math.abs(t - lastSaved.current) >= SAVE_EVERY_S) { lastSaved.current = t; persist(t, e.currentTarget.duration); } }}
      onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); mediaPosition(e.currentTarget); }}
      onEnded={() => { persist(duration, duration); if (next) choose(next, true); else { setPlaying(false); setPosition(0); } }}
      onError={() => { if (!src) return; setPlaying(false); setLoading(false); setError("This chapter could not be loaded. Check your connection and try again."); }} />

    {view === "player" ? <main id="main-content" className="chapter-stage">
      <header className="chapter-stage-bar">
        <button className="icon-button" aria-label="All chapters" onClick={() => setView("list")}><ListMusic className="h-5 w-5" /></button>
        <span className="eyebrow">All Chapter Audios</span>
        <a className="icon-button" href="/" aria-label="Back to reading"><BookOpen className="h-5 w-5" /></a>
      </header>
      <div className="chapter-stage-body">
        <Art chapter={chapter.chapter} className="chapter-art-large" />
        <div className="chapter-stage-title"><p className="eyebrow">{label} · {formatLength(chapter.seconds)}</p><h1 className="font-serif">{chapter.title}</h1><p className="study-muted">{chapter.meaning}</p></div>
        <div className="chapter-seek-wrap">
          <input className="chapter-seek" type="range" min={0} max={duration || 1} step={0.5} value={Math.min(position, duration || 1)} style={{ "--pct": `${pct}%` } as React.CSSProperties}
            aria-label="Audio position" aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`} disabled={!duration} onChange={(e) => seek(Number(e.target.value))} />
          <div className="chapter-times tabular-nums"><span>{formatTime(position)}</span><span>-{formatTime(Math.max(0, duration - position))}</span></div>
        </div>
        <div className="chapter-controls">
          <button className="icon-button" aria-label={`Back ${SKIP_S} seconds`} onClick={() => seek(position - SKIP_S)}><RotateCcw className="h-5 w-5" /></button>
          <button className="icon-button" aria-label="Previous chapter" disabled={!prev} onClick={() => choose(prev, playing || loading)}><SkipBack className="h-6 w-6" /></button>
          <button className="player-play chapter-play" aria-label={error ? "Retry audio" : loading ? "Cancel loading" : playing ? "Pause audio" : "Play audio"} onClick={() => { if (error) { setError(""); audioRef.current?.load(); } toggle(); }} disabled={!src}>{PlayIcon}</button>
          <button className="icon-button" aria-label="Next chapter" disabled={!next} onClick={() => choose(next, playing || loading)}><SkipForward className="h-6 w-6" /></button>
          <button className="icon-button" aria-label={`Forward ${SKIP_S} seconds`} onClick={() => seek(position + SKIP_S)}><RotateCw className="h-5 w-5" /></button>
        </div>
        <button className="study-button" onClick={() => setRate(cycleOption(SPEED_OPTIONS, rate))} aria-label={`Speed ${rate}x`}><Gauge className="h-4 w-4" aria-hidden="true" />{rate}x</button>
        {error && <p className="text-center text-sm" role="alert">{error}</p>}
      </div>
      <button className="chapter-collapse icon-button" aria-label="Open chapter list" onClick={() => setView("list")}><ChevronDown className="h-5 w-5 rotate-180" /></button>
    </main> : <main id="main-content" className="chapter-list-page">
      <div className="reading-shell">
        <header className="app-header"><a className="study-button" href="/"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to reading</a><span className="eyebrow">{chapters.length} chapters</span></header>
        <h1 className="font-serif text-3xl">All Chapter Audios</h1>
        <p className="study-muted mb-4 mt-1 text-sm">Full-length Tamil narration for each of the 18 chapters. Your place is saved for every chapter.</p>
        <ol className="chapter-list">
          {chapters.map((c) => {
            const current = c.chapter === chapter.chapter;
            const saved = resumeAt(positions.current, c.chapter);
            return <li key={c.chapter}><button className="chapter-row" aria-current={current ? "true" : undefined} onClick={() => { if (!current) choose(c, true); setView("player"); }}>
              <span className="chapter-row-no tabular-nums">{String(c.chapter).padStart(2, "0")}</span>
              <Art chapter={c.chapter} className="chapter-art-small" />
              <span className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{c.title}</span><span className="study-muted block truncate text-xs">{c.meaning}</span></span>
              <span className="study-muted shrink-0 text-right text-xs tabular-nums">{formatLength(c.seconds)}{saved ? <><br />resume {formatTime(saved)}</> : null}</span>
            </button></li>;
          })}
        </ol>
      </div>
      <section className="chapter-mini" aria-label="Now playing">
        <button className="chapter-mini-open" onClick={() => setView("player")}><Art chapter={chapter.chapter} className="chapter-art-small" /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{label} · {chapter.title}<span className="sr-only"> (open player)</span></span><span className="study-muted block text-xs tabular-nums">{formatTime(position)} / {formatTime(duration)}</span></span></button>
        <button className="player-play" aria-label={error ? "Retry audio" : playing ? "Pause audio" : "Play audio"} onClick={() => { if (error) { setError(""); audioRef.current?.load(); } toggle(); }} disabled={!src}>{error ? <AlertCircle className="h-5 w-5" /> : loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}</button>
        <button className="icon-button" aria-label="Next chapter" disabled={!next} onClick={() => choose(next, playing || loading)}><SkipForward className="h-5 w-5" /></button>
      </section>
    </main>}
  </>;
}
