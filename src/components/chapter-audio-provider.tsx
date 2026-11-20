"use client";
/**
 * App-wide chapter audio: one <audio> element that lives in the root layout, so a chapter keeps playing
 * while the learner moves between reading, profile and the chapter list (and when the app is in the background).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CHAPTER_AUDIO, chapterAudioUrl, neighbour, nextSleep, parsePositions, resumeAt, sleepExpired, withPosition, type ChapterAudio, type Positions, type SleepTimer } from "@/lib/chapter-audio";
import { SPEED_OPTIONS, cycleOption } from "@/lib/audio-playback";
import { audioOwner, claimAudioFocus, onAudioFocus, releaseAudioFocus } from "@/lib/audio-focus";
import { mediaPosition } from "@/components/audio-player";
import { useLearning } from "@/components/learning-provider";
import { ChapterMiniPlayer } from "@/components/chapter-mini-player";

const SAVE_EVERY_S = 5;
export const SKIP_S = 15;
/** A chapter that never starts must end in a message and a retry, not an endless spinner. */
const LOAD_TIMEOUT_MS = 20_000;
const readStore = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStore = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* resume is a convenience */ } };
const finite = (n: number) => (Number.isFinite(n) ? n : 0);

const chapterPosition = (audio: HTMLAudioElement | null) => { if (audioOwner() === "chapter") mediaPosition(audio); };

export type ChapterView = "player" | "list";
type ChapterAudioContextValue = {
  chapters: readonly ChapterAudio[];
  chapter: ChapterAudio | undefined;
  prev: ChapterAudio | undefined;
  next: ChapterAudio | undefined;
  positions: Positions;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  rate: number;
  error: string;
  sleep: SleepTimer;
  ready: boolean;
  /** The learner has started chapter audio in this visit, so other screens show the mini player. */
  engaged: boolean;
  view: ChapterView;
  setView: (view: ChapterView) => void;
  toggle: () => void;
  seek: (to: number) => void;
  choose: (chapter: ChapterAudio | undefined, startPlaying: boolean) => void;
  cycleRate: () => void;
  cycleSleep: () => void;
  dismiss: () => void;
};

const ChapterAudioContext = createContext<ChapterAudioContextValue | null>(null);

export function ChapterAudioProvider({ children }: { children: ReactNode }) {
  const { session } = useLearning();
  const uid = session.user?.uid ?? null;
  const chapters = CHAPTER_AUDIO;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const positionsRef = useRef<Positions>({});
  const lastSaved = useRef(0);
  /** True once the current src has loaded its metadata: until then currentTime belongs to no chapter and must not be saved. */
  const loaded = useRef(false);
  const autoplay = useRef(false);
  const [positions, setPositions] = useState<Positions>({});
  const [chapter, setChapter] = useState<ChapterAudio | undefined>(chapters[0]);
  const [view, setView] = useState<ChapterView>("player");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(chapters[0]?.seconds ?? 0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const [sleep, setSleep] = useState<SleepTimer>(null);
  const [ready, setReady] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [owner, setOwner] = useState(audioOwner);
  const keys = uid ? { positions: `gita-chapter-audio-v1:${uid}`, last: `gita-chapter-audio-last:${uid}` } : null;
  const positionsKey = keys?.positions;
  const lastKey = keys?.last;

  // Per account: restore the last chapter and every saved position; signing out stops playback.
  useEffect(() => {
    loaded.current = false;
    audioRef.current?.pause();
    if (audioOwner() === "chapter" && "mediaSession" in navigator) navigator.mediaSession.metadata = null;
    releaseAudioFocus("chapter");
    setPlaying(false); setLoading(false); setEngaged(false); setError(""); setSleep(null); setPosition(0);
    autoplay.current = false;
    if (!positionsKey || !lastKey) { setReady(false); return; }
    positionsRef.current = parsePositions(readStore(positionsKey));
    setPositions(positionsRef.current);
    const found = chapters.find((c) => c.chapter === Number(readStore(lastKey))) ?? chapters[0];
    setChapter(found); setDuration(found?.seconds ?? 0); setPosition(found ? resumeAt(positionsRef.current, found.chapter) : 0);
    setReady(true);
  }, [positionsKey, lastKey, chapters]);

  const persist = useCallback((seconds: number, total: number) => {
    if (!chapter || !positionsKey || !lastKey || !loaded.current) return;
    positionsRef.current = withPosition(positionsRef.current, chapter.chapter, seconds, finite(total));
    setPositions(positionsRef.current);
    writeStore(positionsKey, JSON.stringify(positionsRef.current));
    writeStore(lastKey, String(chapter.chapter));
  }, [chapter, positionsKey, lastKey]);
  useEffect(() => {
    const save = () => { const a = audioRef.current; if (a && a.currentTime) persist(a.currentTime, a.duration); };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [persist]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    setEngaged(true);
    setSleep((t) => (sleepExpired(t, Date.now()) ? null : t)); // a timer that ran out while paused must not stop this Play
    try { setError(""); setLoading(true); if (audio.error) { loaded.current = false; audio.load(); } await audio.play(); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setLoading(false); setPlaying(false); setError("Playback did not start. Tap Play to try again."); }
  }, []);
  const pause = useCallback(() => { autoplay.current = false; audioRef.current?.pause(); setLoading(false); }, []);
  const seek = useCallback((to: number) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(to, Number.isFinite(a.duration) ? a.duration : to));
    a.currentTime = clamped; setPosition(clamped); chapterPosition(a);
  }, []);
  const choose = useCallback((target: ChapterAudio | undefined, startPlaying: boolean) => {
    if (!target) return;
    const a = audioRef.current;
    if (a && a.currentTime) persist(a.currentTime, a.duration);
    if (startPlaying) setEngaged(true);
    if (target.chapter === chapter?.chapter) { if (startPlaying && a?.paused) void play(); return; }
    autoplay.current = startPlaying;
    loaded.current = false;
    setError(""); setPosition(resumeAt(positionsRef.current, target.chapter)); setDuration(target.seconds); setPlaying(false); setLoading(startPlaying);
    setChapter(target);
  }, [chapter, persist, play]);
  const retry = useCallback(() => { setError(""); loaded.current = false; audioRef.current?.load(); void play(); }, [play]);
  const toggle = useCallback(() => { if (error) retry(); else if (playing || loading) pause(); else void play(); }, [error, retry, playing, loading, pause, play]);
  const dismiss = useCallback(() => {
    pause(); setEngaged(false); setSleep(null);
    // Only clear the Lock Screen when it shows this chapter, never while a verse owns it.
    if (audioOwner() === "chapter" && "mediaSession" in navigator) navigator.mediaSession.metadata = null;
    releaseAudioFocus("chapter");
  }, [pause]);
  const cycleRate = useCallback(() => setRate((r) => cycleOption(SPEED_OPTIONS, r)), []);
  const cycleSleep = useCallback(() => setSleep((s) => nextSleep(s, Date.now())), []);
  const prev = neighbour(chapters, chapter?.chapter ?? 0, -1);
  const next = neighbour(chapters, chapter?.chapter ?? 0, 1);

  // Hand-off with the verse player: whoever starts playing owns the speaker and the Lock Screen controls.
  useEffect(() => onAudioFocus((nextOwner) => {
    setOwner(nextOwner);
    if (nextOwner === "verse") pause();
  }), [pause]);

  useEffect(() => {
    if (!loading || playing) return;
    const timer = setTimeout(() => {
      autoplay.current = false; audioRef.current?.pause();
      setLoading(false); setPlaying(false);
      setError("This chapter is taking too long to load. Check your connection, then tap Play to try again.");
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading, playing]);

  // Timed sleep: checked on every progress tick (works in the background) and by a timer as a fallback.
  useEffect(() => {
    if (!sleep || sleep.choice === "end" || !playing) return;
    const timer = setTimeout(pause, Math.max(0, sleep.until - Date.now()));
    return () => clearTimeout(timer);
  }, [sleep, playing, pause]);

  useEffect(() => { if (audioRef.current) { audioRef.current.playbackRate = rate; chapterPosition(audioRef.current); } }, [rate, chapter]);
  useEffect(() => {
    if (owner !== "chapter" || !chapter || !("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: `Chapter ${chapter.chapter} · ${chapter.title}`, artist: "Bhagavad Gita", album: "All chapters", artwork: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }] });
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ["play", () => void play()], ["pause", pause],
      ["previoustrack", prev ? () => choose(prev, true) : null], ["nexttrack", next ? () => choose(next, true) : null],
      ["seekbackward", () => seek((audioRef.current?.currentTime ?? 0) - SKIP_S)], ["seekforward", () => seek((audioRef.current?.currentTime ?? 0) + SKIP_S)],
      ["seekto", (d) => { if (typeof d.seekTime === "number") seek(d.seekTime); }],
    ];
    for (const [action, handler] of handlers) { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* optional browser capability */ } }
    return () => { for (const [action] of handlers) { try { navigator.mediaSession.setActionHandler(action, null); } catch { /* optional */ } } };
  }, [owner, chapter, prev, next, play, pause, choose, seek]);
  useEffect(() => { if (owner === "chapter" && "mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused"; }, [owner, playing]);

  const src = useMemo(() => (chapter && ready ? chapterAudioUrl(chapter.key) : undefined), [chapter, ready]);

  const value = useMemo<ChapterAudioContextValue>(() => ({
    chapters, chapter, prev, next, positions, playing, loading, position, duration, rate, error, sleep, ready, engaged, view,
    setView, toggle, seek, choose, cycleRate, cycleSleep, dismiss,
  }), [chapters, chapter, prev, next, positions, playing, loading, position, duration, rate, error, sleep, ready, engaged, view, toggle, seek, choose, cycleRate, cycleSleep, dismiss]);

  // The shared <audio> comes after the page, so a screen's own player stays its first audio element.
  return <ChapterAudioContext.Provider value={value}>
    {children}
    {uid && chapter && <audio ref={audioRef} src={src} preload="metadata"
      onLoadedMetadata={(e) => { const a = e.currentTarget; loaded.current = true; lastSaved.current = resumeAt(positionsRef.current, chapter.chapter); setDuration(Number.isFinite(a.duration) ? a.duration : chapter.seconds); const at = resumeAt(positionsRef.current, chapter.chapter); if (at && at < a.duration) { a.currentTime = at; setPosition(at); } chapterPosition(a); }}
      onWaiting={() => setLoading(true)} onCanPlay={() => { setLoading(false); if (autoplay.current) { autoplay.current = false; void play(); } }}
      onPlay={(e) => { claimAudioFocus("chapter"); setPlaying(true); setLoading(false); chapterPosition(e.currentTarget); }}
      // A real pause (button, Lock Screen, phone call) cancels a timed sleep: it would expire while paused and stop the next Play at once.
      // Not the pause browsers fire at the end of a chapter or while switching chapters, and never "end of chapter".
      onPause={(e) => { setPlaying(false); if (!e.currentTarget.ended && loaded.current) setSleep((s) => (s?.choice === "end" ? s : null)); const a = e.currentTarget; if (a.currentTime) persist(a.currentTime, a.duration); chapterPosition(a); }}
      onTimeUpdate={(e) => {
        const t = e.currentTarget.currentTime;
        setPosition(t);
        if (Math.abs(t - lastSaved.current) >= SAVE_EVERY_S) { lastSaved.current = t; persist(t, e.currentTarget.duration); }
        if (sleepExpired(sleep, Date.now())) pause();
      }}
      onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); chapterPosition(e.currentTarget); }}
      onEnded={() => {
        persist(duration, duration);
        if (sleep?.choice === "end") { setSleep(null); setPlaying(false); return; }
        if (next) choose(next, true); else { setPlaying(false); setPosition(0); }
      }}
      onError={() => { if (!src) return; autoplay.current = false; setPlaying(false); setLoading(false); setError("This chapter could not be loaded. Check your connection and try again."); }} />}
    {uid && <ChapterMiniPlayer />}
  </ChapterAudioContext.Provider>;
}

export function useChapterAudio() {
  const value = useContext(ChapterAudioContext);
  if (!value) throw new Error("ChapterAudioProvider is required");
  return value;
}
