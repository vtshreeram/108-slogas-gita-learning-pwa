/** Pure rules for the "All Chapter Audios" player: the chapter list, neighbours and resume positions (no DOM, no React). */
import durations from "@/data/chapter-audio.json";

export type ChapterAudio = { chapter: number; title: string; meaning: string; key: string; seconds: number; bytes: number };

/** Tracks are served from R2 (set NEXT_PUBLIC_CHAPTER_AUDIO_BASE at build time); local dev falls back to public/chapter-audio. */
export const CHAPTER_AUDIO_BASE = (process.env.NEXT_PUBLIC_CHAPTER_AUDIO_BASE || "/chapter-audio").replace(/\/+$/, "");
export const chapterAudioUrl = (key: string, base = CHAPTER_AUDIO_BASE) => `${base.replace(/\/+$/, "")}/${key}`;

const NAMES: readonly [string, string][] = [
  ["Arjuna Viṣāda Yoga", "The yoga of Arjuna's dejection"],
  ["Sāṅkhya Yoga", "The yoga of knowledge"],
  ["Karma Yoga", "The yoga of action"],
  ["Jñāna Karma Sannyāsa Yoga", "Knowledge and the renunciation of action"],
  ["Karma Sannyāsa Yoga", "The yoga of renunciation"],
  ["Ātma Saṃyama Yoga", "The yoga of self-control"],
  ["Jñāna Vijñāna Yoga", "Knowledge and realization"],
  ["Akṣara Brahma Yoga", "The imperishable Brahman"],
  ["Rāja Vidyā Rāja Guhya Yoga", "The royal knowledge and royal secret"],
  ["Vibhūti Yoga", "The divine glories"],
  ["Viśvarūpa Darśana Yoga", "The vision of the universal form"],
  ["Bhakti Yoga", "The yoga of devotion"],
  ["Kṣetra Kṣetrajña Vibhāga Yoga", "The field and the knower of the field"],
  ["Guṇatraya Vibhāga Yoga", "The three modes of nature"],
  ["Puruṣottama Yoga", "The supreme person"],
  ["Daivāsura Sampad Vibhāga Yoga", "The divine and demoniac natures"],
  ["Śraddhātraya Vibhāga Yoga", "The three kinds of faith"],
  ["Mokṣa Sannyāsa Yoga", "Liberation through renunciation"],
];

type Measured = { chapter: number; key: string; seconds: number; bytes: number };
export function buildChapters(measured: readonly Measured[] = durations): ChapterAudio[] {
  return [...measured].sort((a, b) => a.chapter - b.chapter).flatMap((m) => {
    const name = NAMES[m.chapter - 1];
    return name ? [{ ...m, title: name[0], meaning: name[1] }] : [];
  });
}
export const CHAPTER_AUDIO = buildChapters();

/** The chapter `delta` steps from `chapter`, or undefined past either end of the list. */
export function neighbour(chapters: readonly ChapterAudio[], chapter: number, delta: number) {
  const at = chapters.findIndex((c) => c.chapter === chapter);
  return at < 0 ? undefined : chapters[at + delta];
}

export type Positions = Record<string, number>;
const RESUME_MIN = 5; // under this the learner has barely started
const RESUME_TAIL = 10; // inside this tail the chapter counts as finished

export function parsePositions(raw: string | null): Positions {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0)) as Positions;
  } catch { return {}; }
}

/** Remember where the learner stopped; drops the entry when they are at the very start or have finished. */
export function withPosition(positions: Positions, chapter: number, seconds: number, duration: number): Positions {
  const next = { ...positions };
  const finished = duration > 0 && seconds >= duration - RESUME_TAIL;
  if (seconds < RESUME_MIN || finished) delete next[String(chapter)];
  else next[String(chapter)] = Math.floor(seconds);
  return next;
}
export const resumeAt = (positions: Positions, chapter: number) => positions[String(chapter)] ?? 0;

/** "1 h 12 min" / "38 min" for list rows. */
export function formatLength(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
