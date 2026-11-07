"use client";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Repeat, Loader2, AlertCircle, SkipBack, SkipForward, Gauge } from "lucide-react";
import { LoopMode, REPEAT_COUNTS, SPEED_OPTIONS, decideOnEnded, cycleLoop, cycleOption, formatTime } from "@/lib/audio-playback";
import { downloadedAudio, hasDownloadedAudio } from "@/lib/offline-audio";
import { AUDIO_TRANSPORT_EVENT } from "@/lib/line-practice";

const mediaState = (state: "playing" | "paused") => { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state; };
const userTransport = () => window.dispatchEvent(new Event(AUDIO_TRANSPORT_EVENT));
type Props = {
  audioSrc: string; title: string; isFirst: boolean; isLast: boolean; audioAvailable: boolean;
  setAudioAvailable: (value: boolean) => void; onNext: () => void; onPrev: () => void;
  elementRef: RefObject<HTMLAudioElement | null>; linePracticeActive: boolean;
};

export function AudioPlayer({ audioSrc, title, isFirst, isLast, audioAvailable, setAudioAvailable, onNext, onPrev, elementRef, linePracticeActive }: Props) {
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
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    let generation = 0;
    let resolved = false;
    setSource(undefined); setPosition(0); setDuration(0); setPlaying(false); setLoading(false); setError(""); setAudioAvailable(true); repetition.current = 0;
    const reference = audioSrc.replace(/^\/audio\//, "").replace(/\.mp3$/, "");
    const resolve = async () => {
      const current = ++generation;
      // "gita-downloads-changed" fires after every saved file; only read a recording when this verse's status actually flipped.
      let saved = false;
      try { saved = await hasDownloadedAudio(reference); } catch { /* stream when storage is blocked */ }
      if (!alive || current !== generation) return;
      if (resolved && saved === Boolean(objectUrl)) return;
      let nextUrl: string | null = null;
      if (saved) { try { nextUrl = await downloadedAudio(reference); } catch { /* stream instead */ } }
      if (!alive || current !== generation) { if (nextUrl) URL.revokeObjectURL(nextUrl); return; }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = nextUrl;
      resolved = true;
      setSource(nextUrl ?? audioSrc);
    };
    void resolve();
    const refresh = () => { if (elementRef.current?.paused) void resolve(); };
    window.addEventListener("gita-downloads-changed", refresh);
    return () => { alive = false; window.removeEventListener("gita-downloads-changed", refresh); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [audioSrc, setAudioAvailable, elementRef]);

  const play = useCallback(async () => {
    const audio = elementRef.current;
    if (!audio || !audio.src) return;
    try { setError(""); setLoading(true); await audio.play(); }
    catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setLoading(false); setPlaying(false); setError("Playback did not start. Tap Play to try again.");
    }
  }, [elementRef]);
  const pause = useCallback(() => { elementRef.current?.pause(); setLoading(false); mediaState("paused"); }, [elementRef]);
  const stop = useCallback(() => { userTransport(); pause(); if (elementRef.current) elementRef.current.currentTime = 0; setPosition(0); repetition.current = 0; autoplay.current = false; }, [pause, elementRef]);
  const next = useCallback(() => { userTransport(); if (!isLast) { autoplay.current = true; onNext(); } }, [isLast, onNext]);
  const prev = useCallback(() => { userTransport(); autoplay.current = false; if (!isFirst) onPrev(); }, [isFirst, onPrev]);
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
  useEffect(() => { if (elementRef.current) elementRef.current.playbackRate = rate; }, [rate, source, elementRef]);

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
    <section aria-label="Audio player" className="fixed bottom-0 left-0 right-0 border-t border-[#ebd6ab] dark:border-[#423321] bg-[#fffcf5] dark:bg-[#1e1710]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-[0_-8px_24px_rgba(143,100,34,0.05)] z-40">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <audio ref={elementRef} src={source} preload="metadata"
          onWaiting={() => setLoading(true)} onCanPlay={() => { setLoading(false); if (autoplay.current) { autoplay.current = false; void play(); } }}
          onPlay={() => { setPlaying(true); setLoading(false); mediaState("playing"); }} onPause={() => { setPlaying(false); mediaState("paused"); }}
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)} onDurationChange={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
          onEnded={ended} onError={() => { if (!source) return; userTransport(); setAudioAvailable(false); setPlaying(false); setLoading(false); setError("Audio unavailable. Check your connection or download this verse for offline use."); }} />

        <div className="flex items-center gap-3">
          <span className="w-10 text-right text-xs font-medium tabular-nums text-[#705735] dark:text-[#bda27e]">{formatTime(position)}</span>
          <div className="relative flex h-8 flex-1 items-center">
            <input className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" aria-label="Audio position" type="range" min={0} max={duration || 1} step={0.05} value={Math.min(position, duration || 1)} disabled={!duration} onChange={(e) => { userTransport(); if (elementRef.current) elementRef.current.currentTime = Number(e.target.value); setPosition(Number(e.target.value)); }} />
            <div className="absolute left-0 right-0 h-2 overflow-hidden rounded-full bg-[#f4e9cb] dark:bg-[#2d2218] peer-focus-visible:ring-2 peer-focus-visible:ring-[#8f6422] peer-focus-visible:ring-offset-2">
              <div className="h-full bg-[#c0a986] transition-all duration-100 ease-linear" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="w-10 text-xs font-medium tabular-nums text-[#705735] dark:text-[#bda27e]">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <button disabled={linePracticeActive} onClick={() => { setLoopMode(cycleLoop(loopMode)); repetition.current = 0; }} aria-label={`Loop: ${loopLabel}`}
              className={`flex h-9 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors disabled:opacity-40 ${loopMode !== "off" ? "bg-[#fcebc4] dark:bg-[#2d2218] text-[#8f6422] dark:text-[#d4aa61]" : "text-[#705735] dark:text-[#bda27e]"}`}>
              <Repeat className="h-4 w-4" /><span>{loopLabel}</span>
            </button>
            {loopMode !== "off" && (
              <button disabled={linePracticeActive} onClick={() => { setRepeatCount(cycleOption(REPEAT_COUNTS, repeatCount)); repetition.current = 0; }} aria-label={`Repeat ${repeatLabel}`}
                className="flex h-9 items-center rounded-full bg-[#fcebc4] dark:bg-[#2d2218] px-2 text-[11px] font-bold tabular-nums text-[#8f6422] dark:text-[#d4aa61]">{repeatLabel}</button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={prev} disabled={isFirst} aria-label="Previous shloka" className="flex h-10 w-10 items-center justify-center rounded-full text-[#5c431b] dark:text-[#f0e3ce] disabled:opacity-30"><SkipBack className="h-5 w-5 fill-current" /></button>
            <button onClick={toggle} disabled={!source} aria-label={loading ? "Cancel loading" : playing ? "Pause audio" : audioAvailable ? "Play audio" : "Retry audio"} className="flex h-14 w-14 items-center justify-center rounded-full bg-[#4a3615] text-[#fcebc4] shadow-[0_4px_12px_rgba(74,54,21,0.2)] transition-transform active:scale-95 disabled:opacity-50 dark:bg-[#d4aa61] dark:text-[#1e1710]">
              {!audioAvailable ? <AlertCircle className="h-6 w-6 text-red-400" /> : loading ? <Loader2 className="h-6 w-6 animate-spin" /> : playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
            </button>
            <button onClick={next} disabled={isLast} aria-label="Next shloka" className="flex h-10 w-10 items-center justify-center rounded-full text-[#5c431b] dark:text-[#f0e3ce] disabled:opacity-30"><SkipForward className="h-5 w-5 fill-current" /></button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setRate(cycleOption(SPEED_OPTIONS, rate))} aria-label={`Speed ${rate}x`}
              className={`flex h-9 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors ${rate !== 1 ? "bg-[#fcebc4] dark:bg-[#2d2218] text-[#8f6422] dark:text-[#d4aa61]" : "text-[#705735] dark:text-[#bda27e]"}`}>
              <Gauge className="h-4 w-4" /><span>{rate}x</span>
            </button>
            <button onClick={stop} aria-label="Stop playback" className="flex h-9 w-9 items-center justify-center rounded-full text-[#705735] dark:text-[#bda27e]"><Square className="h-4 w-4 fill-current" /></button>
          </div>
        </div>
        {error && <p className="text-center text-xs text-[#705735] dark:text-[#bda27e]" role="alert">{error}</p>}
      </div>
    </section>
  );
}
