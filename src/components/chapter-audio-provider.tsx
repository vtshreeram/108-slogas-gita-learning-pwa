"use client";
/**
 * App-wide chapter audio: one <audio> element that lives in the root layout, so a chapter keeps playing
 * while the learner moves between reading, profile and the chapter list (and when the app is in the background).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { savedChapterAudio, savedChapterUrls } from "@/lib/chapter-audio-cache";
import { CHAPTER_AUDIO, chapterAudioUrl, neighbour, nextSleep, parsePositions, resumeAt, sleepExpired, withPosition, type ChapterAudio, type Positions, type SleepTimer } from "@/lib/chapter-audio";
import { SPEED_OPTIONS, cycleOption } from "@/lib/audio-playback";
import { claimAudioFocus, onAudioFocus, releaseAudioFocus, removeMediaPlayer, setMediaPlayback, setMediaPosition, updateMediaPlayer } from "@/lib/audio-focus";
import { useLearningSession } from "@/components/learning-provider";
import { ChapterMiniPlayer } from "@/components/chapter-mini-player";

const SAVE_EVERY_S = 5;
export const SKIP_S = 15;
/** A chapter that never starts must end in a message and a retry, not an endless spinner. */
const LOAD_TIMEOUT_MS = 20_000;
const readStore = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStore = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* resume is a convenience */ } };
const finite = (n: number) => (Number.isFinite(n) ? n : 0);

const chapterPosition = (audio: HTMLAudioElement | null) => setMediaPosition("chapter", audio);

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
  /** The learner can continue chapter audio from other screens. */
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
  const { user } = useLearningSession();
  const uid = user?.uid ?? null;
  const chapters = CHAPTER_AUDIO;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceTrack = useRef<ChapterAudio | undefined>(undefined);
  const positionsRef = useRef<Positions>({});
  const lastSaved = useRef(0);
  /** True once the current src has loaded its metadata: until then currentTime belongs to no chapter and must not be saved. */
  const loaded = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const playRequest = useRef(0);
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
  /** Recordings saved in the Offline library (full URLs), and the current chapter's saved copy as an object URL. */
  const [savedUrls, setSavedUrls] = useState<ReadonlySet<string>>(new Set());
  const prepared = useRef<{ key: string; url: string } | null>(null);
  const positionsKey = uid ? `gita-chapter-audio-v1:${uid}` : null;
  const lastKey = uid ? `gita-chapter-audio-last:${uid}` : null;
  const miniPlayerKey = uid ? `gita-chapter-audio-mini:${uid}` : null;

  // Per account: restore the last chapter and every saved position; signing out stops playback.
  useEffect(() => {
    loaded.current = false;
    sourceTrack.current = undefined;
    pendingSeek.current = null;
    playRequest.current++;
    const audio = audioRef.current;
    if (audio?.hasAttribute("src")) {
      audio.pause(); audio.removeAttribute("src"); audio.load();
    }
    releaseAudioFocus("chapter");
    setPlaying(false); setLoading(false); setEngaged(false); setError(""); setSleep(null); setPosition(0);
    if (!positionsKey || !lastKey || !miniPlayerKey) { setReady(false); return; }
    positionsRef.current = parsePositions(readStore(positionsKey));
    setPositions(positionsRef.current);
    const found = chapters.find((c) => c.chapter === Number(readStore(lastKey))) ?? chapters[0];
    setChapter(found); setDuration(found?.seconds ?? 0); setPosition(found ? resumeAt(positionsRef.current, found.chapter) : 0);
    setEngaged(readStore(miniPlayerKey) === "1");
    setReady(true);
  }, [positionsKey, lastKey, miniPlayerKey, chapters]);
  useEffect(() => () => removeMediaPlayer("chapter"), []);

  // Know which chapters are saved; re-check whenever the Offline library changes something.
  useEffect(() => {
    let alive = true;
    const check = () => { void savedChapterUrls().then((urls) => { if (alive) setSavedUrls(urls); }).catch(() => {}); };
    check();
    window.addEventListener("gita-downloads-changed", check);
    return () => { alive = false; window.removeEventListener("gita-downloads-changed", check); };
  }, []);
  const isSaved = useCallback((track: ChapterAudio) => savedUrls.has(new URL(chapterAudioUrl(track.key), location.href).href), [savedUrls]);
  /** Read a saved chapter into an object URL ahead of time, so Play can attach it inside the tap (iOS requires that). */
  const prepare = useCallback(async (track: ChapterAudio) => {
    if (prepared.current?.key === track.key) return prepared.current.url;
    const url = await savedChapterAudio(chapterAudioUrl(track.key)).catch(() => null);
    if (!url) return null;
    const old = prepared.current;
    prepared.current = { key: track.key, url };
    // Never pull a file out from under the element while it is still attached.
    if (old && audioRef.current?.getAttribute("src") !== old.url) URL.revokeObjectURL(old.url);
    return url;
  }, []);
  useEffect(() => {
    if (chapter && isSaved(chapter)) void prepare(chapter);
  }, [chapter, isSaved, prepare]);
  useEffect(() => () => { if (prepared.current) URL.revokeObjectURL(prepared.current.url); }, []);
  /** The saved copy when it is ready, otherwise the streamed file. */
  const sourceFor = useCallback((track: ChapterAudio) => prepared.current?.key === track.key ? prepared.current.url : chapterAudioUrl(track.key), []);

  const persist = useCallback((seconds: number, total: number) => {
    const track = sourceTrack.current;
    if (!track || !positionsKey || !lastKey || !loaded.current) return;
    positionsRef.current = withPosition(positionsRef.current, track.chapter, seconds, finite(total));
    setPositions(positionsRef.current);
    writeStore(positionsKey, JSON.stringify(positionsRef.current));
    writeStore(lastKey, String(track.chapter));
  }, [positionsKey, lastKey]);
  useEffect(() => {
    const save = () => { const a = audioRef.current; if (a && a.currentTime) persist(a.currentTime, a.duration); };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [persist]);

  const play = useCallback(async (track = chapter) => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    const request = ++playRequest.current;
    // Normally prepared already; if a saved chapter was picked from the list before it was read, read it now.
    if (isSaved(track) && prepared.current?.key !== track.key) await prepare(track);
    if (request !== playRequest.current) return;
    const source = sourceFor(track);
    setEngaged(true);
    setSleep((t) => (sleepExpired(t, Date.now()) ? null : t)); // a timer that ran out while paused must not stop this Play
    try {
      setError(""); setLoading(true);
      // Attach the source and start playback in the same click or system media action.
      sourceTrack.current = track;
      if (audio.getAttribute("src") !== source) { loaded.current = false; audio.src = source; }
      else if (audio.error) { loaded.current = false; audio.load(); }
      await audio.play();
    } catch (error) {
      if (request !== playRequest.current) return;
      setLoading(false); setPlaying(false); setMediaPlayback("chapter", "paused");
      if (!(error instanceof DOMException && error.name === "AbortError")) setError("Playback did not start. Tap Play to try again.");
    }
  }, [chapter, isSaved, prepare, sourceFor]);
  const pause = useCallback(() => {
    playRequest.current++;
    audioRef.current?.pause(); setLoading(false); setMediaPlayback("chapter", "paused");
  }, []);
  const seek = useCallback((to: number) => {
    const a = audioRef.current;
    if (!a) return;
    const total = loaded.current && Number.isFinite(a.duration) ? a.duration : duration;
    const clamped = Math.max(0, Math.min(to, total || to));
    if (loaded.current) a.currentTime = clamped;
    else pendingSeek.current = clamped;
    setPosition(clamped); chapterPosition(a);
  }, [duration]);
  const choose = useCallback((target: ChapterAudio | undefined, startPlaying: boolean) => {
    if (!target) return;
    const a = audioRef.current;
    if (a && a.currentTime) persist(a.currentTime, a.duration);
    if (target.chapter === chapter?.chapter) { if (startPlaying && a?.paused) void play(target); return; }
    pause();
    loaded.current = false;
    pendingSeek.current = null;
    setError(""); setPosition(resumeAt(positionsRef.current, target.chapter)); setDuration(target.seconds); setPlaying(false); setLoading(startPlaying);
    setChapter(target);
    if (startPlaying) void play(target);
    else {
      sourceTrack.current = undefined;
      if (a?.hasAttribute("src")) { a.removeAttribute("src"); a.load(); }
      releaseAudioFocus("chapter");
    }
  }, [chapter, pause, persist, play]);
  const toggle = useCallback(() => { if (playing || loading) pause(); else void play(); }, [playing, loading, pause, play]);
  const dismiss = useCallback(() => {
    pause(); setEngaged(false); setSleep(null);
    if (miniPlayerKey) writeStore(miniPlayerKey, "");
    releaseAudioFocus("chapter");
  }, [miniPlayerKey, pause]);
  const cycleRate = useCallback(() => setRate((r) => cycleOption(SPEED_OPTIONS, r)), []);
  const cycleSleep = useCallback(() => setSleep((s) => nextSleep(s, Date.now())), []);
  const prev = neighbour(chapters, chapter?.chapter ?? 0, -1);
  const next = neighbour(chapters, chapter?.chapter ?? 0, 1);

  // Hand-off with the verse player: whoever starts playing owns the speaker and the Lock Screen controls.
  useEffect(() => onAudioFocus((nextOwner) => {
    if (nextOwner !== "verse") return;
    pause();
    if (miniPlayerKey) writeStore(miniPlayerKey, "");
  }), [miniPlayerKey, pause]);

  useEffect(() => {
    if (!loading || playing) return;
    const timer = setTimeout(() => {
      pause(); setPlaying(false);
      setError("This chapter is taking too long to load. Check your connection, then tap Play to try again.");
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading, playing, pause]);

  // Timed sleep: checked on every progress tick (works in the background) and by a timer as a fallback.
  useEffect(() => {
    if (!sleep || sleep.choice === "end" || !playing) return;
    const timer = setTimeout(pause, Math.max(0, sleep.until - Date.now()));
    return () => clearTimeout(timer);
  }, [sleep, playing, pause]);

  useEffect(() => { if (audioRef.current) { audioRef.current.playbackRate = rate; chapterPosition(audioRef.current); } }, [rate, chapter]);
  useEffect(() => {
    if (!chapter) return;
    updateMediaPlayer("chapter", {
      metadata: { title: `Chapter ${chapter.chapter} · ${chapter.title}`, album: "All chapters" },
      actions: {
        play: () => void play(), pause,
        previoustrack: prev ? () => choose(prev, true) : undefined,
        nexttrack: next ? () => choose(next, true) : undefined,
        seekbackward: () => seek((audioRef.current?.currentTime ?? 0) - SKIP_S),
        seekforward: () => seek((audioRef.current?.currentTime ?? 0) + SKIP_S),
        seekto: ({ seekTime }) => { if (typeof seekTime === "number") seek(seekTime); },
      },
    });
  }, [chapter, prev, next, play, pause, choose, seek]);

  const value = useMemo<ChapterAudioContextValue>(() => ({
    chapters, chapter, prev, next, positions, playing, loading, position, duration, rate, error, sleep, ready, engaged, view,
    setView, toggle, seek, choose, cycleRate, cycleSleep, dismiss,
  }), [chapters, chapter, prev, next, positions, playing, loading, position, duration, rate, error, sleep, ready, engaged, view, toggle, seek, choose, cycleRate, cycleSleep, dismiss]);

  // The shared <audio> comes after the page, so a screen's own player stays its first audio element.
  return <ChapterAudioContext.Provider value={value}>
    {children}
    {uid && chapter && <audio ref={audioRef} preload="none"
      onLoadedMetadata={(e) => {
        const audio = e.currentTarget;
        const track = sourceTrack.current;
        if (!track || audio.currentSrc !== audio.src || audio.readyState < audio.HAVE_METADATA) return;
        loaded.current = true;
        const total = Number.isFinite(audio.duration) ? audio.duration : track.seconds;
        const saved = resumeAt(positionsRef.current, track.chapter);
        const at = pendingSeek.current === null ? (saved < total ? saved : 0) : Math.min(pendingSeek.current, total);
        pendingSeek.current = null;
        lastSaved.current = at;
        if (at !== audio.currentTime) audio.currentTime = at;
        setDuration(total); setPosition(at);
        chapterPosition(audio);
      }}
      onWaiting={() => setLoading(true)} onPlaying={() => { setPlaying(true); setLoading(false); }}
      onPlay={(e) => {
        const audio = e.currentTarget;
        const track = sourceTrack.current;
        if (audio.paused || !track) return;
        claimAudioFocus("chapter"); setMediaPlayback("chapter", "playing"); chapterPosition(audio);
        if (lastKey) writeStore(lastKey, String(track.chapter));
        if (miniPlayerKey) writeStore(miniPlayerKey, "1");
      }}
      onPause={(e) => {
        const audio = e.currentTarget;
        if (!audio.paused) return;
        setPlaying(false); setLoading(false); setMediaPlayback("chapter", "paused");
        if (!audio.ended && loaded.current) setSleep((s) => (s?.choice === "end" ? s : null));
        if (audio.currentTime) persist(audio.currentTime, audio.duration);
        chapterPosition(audio);
      }}
      onTimeUpdate={(e) => {
        const t = e.currentTarget.currentTime;
        setPosition(t);
        if (Math.abs(t - lastSaved.current) >= SAVE_EVERY_S) { lastSaved.current = t; persist(t, e.currentTarget.duration); }
        if (sleepExpired(sleep, Date.now())) pause();
      }}
      onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); chapterPosition(e.currentTarget); }}
      onEnded={() => {
        persist(duration, duration);
        if (next && sleep?.choice !== "end") { choose(next, true); return; }
        setSleep(null); setPlaying(false); setLoading(false);
        if (!next) setPosition(0);
        if (miniPlayerKey) writeStore(miniPlayerKey, "");
        releaseAudioFocus("chapter");
      }}
      onError={(e) => { if (!e.currentTarget.hasAttribute("src")) return; setPlaying(false); setLoading(false); setMediaPlayback("chapter", "paused"); setError(navigator.onLine ? "This chapter could not be loaded. Check your connection and try again." : "You are offline and this chapter is not saved on this device. Save chapters in the Offline library (Profile) to play them without internet."); }} />}
    {uid && <ChapterMiniPlayer />}
  </ChapterAudioContext.Provider>;
}

export function useChapterAudio() {
  const value = useContext(ChapterAudioContext);
  if (!value) throw new Error("ChapterAudioProvider is required");
  return value;
}
