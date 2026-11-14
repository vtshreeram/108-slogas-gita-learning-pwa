"use client";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Repeat, Loader2, AlertCircle, SkipBack, SkipForward, Gauge, ChevronUp, ChevronDown } from "lucide-react";
import { LoopMode, REPEAT_COUNTS, SPEED_OPTIONS, decideOnEnded, cycleLoop, cycleOption, formatTime } from "@/lib/audio-playback";
import { downloadedAudio, hasDownloadedAudio } from "@/lib/offline-audio";
import { AUDIO_TRANSPORT_EVENT } from "@/lib/line-practice";

const mediaState = (state: "playing" | "paused") => { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state; };
const LOAD_TIMEOUT_MS = 15_000;
export const mediaPosition = (audio: HTMLAudioElement | null) => {
  if (!audio || !("mediaSession" in navigator) || typeof navigator.mediaSession.setPositionState !== "function") return;
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(Math.max(0, audio.currentTime), audio.duration) });
  } catch { /* optional browser capability */ }
};
const userTransport = () => window.dispatchEvent(new Event(AUDIO_TRANSPORT_EVENT));
type Props = {
  audioSrc: string; title: string; isFirst: boolean; isLast: boolean; audioAvailable: boolean;
  setAudioAvailable: (value: boolean) => void; onNext: () => void; onPrev: () => void;
  elementRef: RefObject<HTMLAudioElement | null>; linePracticeActive: boolean;
};

export function AudioPlayer({ audioSrc, title, isFirst, isLast, audioAvailable, setAudioAvailable, onNext, onPrev, elementRef, linePracticeActive }: Props) {
  const playerRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [loopMode, setLoopMode] = useState<LoopMode>("off");
  const [repeatCount, setRepeatCount] = useState(1);
  const repetition = useRef(0);
  const autoplay = useRef(false);
  const playingRef = useRef(false);
  const navRef = useRef({ onNext, onPrev });
  playingRef.current = playing;
  navRef.current = { onNext, onPrev };
  const [error, setError] = useState("");

  // A recording that never starts must end in a message and a retry, not an endless spinner.
  // Only while a recording has not started playing: normal buffering mid-chant must never be cut off.
  useEffect(() => {
    if (!loading || playing) return;
    const timer = setTimeout(() => {
      autoplay.current = false;
      elementRef.current?.pause();
      setLoading(false); setPlaying(false);
      setError("This recording is taking too long. Check your connection, then tap Play to try again.");
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading, playing, elementRef]);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    let generation = 0;
    let resolved = false;
    setSource(undefined); setPosition(0); setDuration(0); setPlaying(false); setLoading(false); setError(""); setAudioAvailable(true); repetition.current = 0;
    const reference = audioSrc.replace(/^\/audio\//, "").replace(/\.mp3$/, "");
    const resolve = async (onlyWhenPaused = false) => {
      const current = ++generation;
      // "gita-downloads-changed" fires after every saved file; only read a recording when this verse's status actually flipped.
      let saved = false;
      try { saved = await hasDownloadedAudio(reference); } catch { /* stream when storage is blocked */ }
      if (!alive || current !== generation) return;
      if (resolved && saved === Boolean(objectUrl)) return;
      let nextUrl: string | null = null;
      if (saved) { try { nextUrl = await downloadedAudio(reference); } catch { /* stream instead */ } }
      if (!alive || current !== generation) { if (nextUrl) URL.revokeObjectURL(nextUrl); return; }
      // A download may finish while the learner starts playback; never replace its source mid-chant.
      if (onlyWhenPaused && elementRef.current && !elementRef.current.paused) { if (nextUrl) URL.revokeObjectURL(nextUrl); return; }
      if (resolved && Boolean(nextUrl) === Boolean(objectUrl)) { if (nextUrl) URL.revokeObjectURL(nextUrl); return; }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = nextUrl;
      resolved = true;
      setSource(nextUrl ?? audioSrc);
    };
    void resolve();
    const refresh = () => { if (elementRef.current?.paused) void resolve(true); };
    window.addEventListener("gita-downloads-changed", refresh);
    return () => { alive = false; window.removeEventListener("gita-downloads-changed", refresh); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [audioSrc, setAudioAvailable, elementRef]);

  const play = useCallback(async () => {
    const audio = elementRef.current;
    if (!audio || !audio.src) return;
    try {
      setError(""); setLoading(true);
      if (audio.error) { setAudioAvailable(true); audio.load(); }
      await audio.play();
    }
    catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setLoading(false); setPlaying(false); setError("Playback did not start. Tap Play to try again.");
    }
  }, [elementRef, setAudioAvailable]);
  const pause = useCallback(() => { elementRef.current?.pause(); setLoading(false); mediaState("paused"); mediaPosition(elementRef.current); }, [elementRef]);
  const stop = useCallback(() => { userTransport(); pause(); if (elementRef.current) elementRef.current.currentTime = 0; setPosition(0); repetition.current = 0; autoplay.current = false; mediaPosition(elementRef.current); }, [pause, elementRef]);
  // Keep MediaSession action handlers stable across play/pause transitions so iOS Lock Screen never loses the play handler while backgrounded.
  const next = useCallback(() => { userTransport(); if (!isLast) { autoplay.current = playingRef.current; navRef.current.onNext(); } }, [isLast]);
  const prev = useCallback(() => { userTransport(); autoplay.current = false; if (!isFirst) navRef.current.onPrev(); }, [isFirst]);
  const toggle = useCallback(() => {
    userTransport();
    if (playing || loading) pause();
    else {
      if (!audioAvailable) { setAudioAvailable(true); elementRef.current?.load(); }
      void play();
    }
  }, [playing, loading, pause, audioAvailable, setAudioAvailable, elementRef, play]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "Bhagavad Gita", album: "Gita 108", artwork: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }] });
    const actions: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", () => { userTransport(); void play(); }], ["pause", () => { userTransport(); pause(); }], ["stop", stop], ["previoustrack", isFirst ? null : prev], ["nexttrack", isLast ? null : next],
    ];
    for (const [action, handler] of actions) { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* optional browser capability */ } }
    return () => { for (const [action] of actions) { try { navigator.mediaSession.setActionHandler(action, null); } catch { /* optional */ } } };
  }, [title, isFirst, isLast, prev, next, play, pause, stop]);
  useEffect(() => { if (elementRef.current) { elementRef.current.playbackRate = rate; mediaPosition(elementRef.current); } }, [rate, source, elementRef]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const measure = () => document.documentElement.style.setProperty("--audio-player-height", `${player.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(player);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--audio-player-height"); };
  }, []);

  function ended() {
    if (linePracticeActive) return;
    const action = decideOnEnded({ loopMode, repeatCount, currentRepeat: repetition.current, isLast });
    if (action.type === "replay") {
      repetition.current = action.currentRepeat;
      if (elementRef.current) elementRef.current.currentTime = 0;
      void play();
    } else if (action.type === "advance") { repetition.current = 0; autoplay.current = true; onNext(); }
    else { pause(); setPlaying(false); repetition.current = 0; if (elementRef.current) elementRef.current.currentTime = 0; setPosition(0); }
  }
  const loopLabel = loopMode === "off" ? "Off" : loopMode === "repeat" ? "Loop" : "Next";
  const repeatLabel = repeatCount === Infinity ? "∞" : `${repeatCount}x`;
  const pct = duration ? (position / duration) * 100 : 0;
  return (
    <section ref={playerRef} aria-label="Audio player" className="compact-player">
      <div className="player-inner">
        <audio ref={elementRef} src={source} preload="metadata"
          onWaiting={() => setLoading(true)} onCanPlay={() => { setLoading(false); if (autoplay.current) { autoplay.current = false; void play(); } }}
          onPlay={(e) => { setPlaying(true); setLoading(false); mediaState("playing"); mediaPosition(e.currentTarget); }} onPause={(e) => { setPlaying(false); mediaState("paused"); mediaPosition(e.currentTarget); }}
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)} onDurationChange={(e) => { setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0); mediaPosition(e.currentTarget); }}
          onEnded={ended} onError={() => { if (!source) return; autoplay.current = false; userTransport(); setAudioAvailable(false); setPlaying(false); setLoading(false); setError("Audio unavailable. Check your connection or download this verse for offline use."); }} />
        <div className="player-main">
          <button className="icon-button" aria-label={expanded ? "Collapse audio controls" : "Expand audio controls"} aria-expanded={expanded} aria-controls="audio-options" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}</button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{title}</p><p className="study-muted text-xs tabular-nums">{loading ? "Loading recording…" : `${formatTime(position)} / ${formatTime(duration)}`}</p></div>
          <button onClick={toggle} disabled={!source} aria-label={loading ? "Cancel loading" : playing ? "Pause audio" : audioAvailable ? "Play audio" : "Retry audio"} className="player-play">
            {!audioAvailable ? <AlertCircle className="h-5 w-5" /> : loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
        </div>
        {expanded && <div id="audio-options" className="player-options">
          <div className="relative flex h-11 items-center">
            <input className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" aria-label="Audio position" aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`} type="range" min={0} max={duration || 1} step={0.05} value={Math.min(position, duration || 1)} disabled={!duration} onChange={(e) => { userTransport(); if (elementRef.current) { elementRef.current.currentTime = Number(e.target.value); mediaPosition(elementRef.current); } setPosition(Number(e.target.value)); }} />
            <div className="pointer-events-none h-1.5 w-full overflow-hidden rounded-full bg-[var(--study-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--study-ink)]"><div className="h-full bg-[var(--study-ink)]" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              <button onClick={prev} disabled={isFirst} aria-label="Previous shloka" className="icon-button"><SkipBack className="h-5 w-5" /></button>
              <button onClick={next} disabled={isLast} aria-label="Next shloka" className="icon-button"><SkipForward className="h-5 w-5" /></button>
              <button onClick={stop} aria-label="Stop playback" className="icon-button"><Square className="h-4 w-4" /></button>
            </div>
            <button className="study-button" onClick={() => setRate(cycleOption(SPEED_OPTIONS, rate))} aria-label={`Speed ${rate}x`}><Gauge className="h-4 w-4" aria-hidden="true" />{rate}x</button>
            <button className="study-button" disabled={linePracticeActive} onClick={() => { setLoopMode(cycleLoop(loopMode)); repetition.current = 0; }} aria-label={`Loop: ${loopLabel}`}><Repeat className="h-4 w-4" aria-hidden="true" />{loopLabel}</button>
            {loopMode !== "off" && <button className="study-button" disabled={linePracticeActive} onClick={() => { setRepeatCount(cycleOption(REPEAT_COUNTS, repeatCount)); repetition.current = 0; }} aria-label={`Repeat ${repeatLabel}`}>{repeatLabel}</button>}
          </div>
        </div>}
        {error && <p className="mt-2 text-sm" role="alert">{error}</p>}
      </div>
    </section>
  );
}
