/**
 * Offline library: pure rules (no DOM, no Cache API). What each pack contains, what is saved,
 * what is missing or out of date, and whether a download fits in the browser's storage.
 * The browser side (downloading, saving, removing) is in offline-downloads.ts.
 */
import { GITA_CHAPTERS } from "./gita-verses";
import { CHAPTER_AUDIO, chapterAudioUrl, formatLength } from "./chapter-audio";
import { AUDIO_CACHE, audioUrl } from "./offline-audio";

/** Chapter text, purports and the search index. The service worker reads and refreshes the same cache. */
export const TEXT_CACHE = "gita-chapters-v1";
/** Saved chapter recordings (cross-origin in production, so keyed by full URL). */
export { CHAPTER_AUDIO_CACHE } from "./chapter-audio-cache";
import { CHAPTER_AUDIO_CACHE } from "./chapter-audio-cache";

export type PackId = "essentials" | "verses108" | "verses657" | `chapter-${number}`;
/** One file of a pack. `bytes` is the expected size when known; text files have none. */
export type PackItem = { url: string; cache: string; bytes?: number };
export type Pack = { id: PackId; title: string; detail: string; items: PackItem[] };
/** What is saved now: URL (pathname for same-origin files) → saved size in bytes. */
export type SavedFiles = ReadonlyMap<string, number>;

export function textItems(): PackItem[] {
  return [
    ...GITA_CHAPTERS.map((c) => ({ url: `/api/chapters/${c}`, cache: TEXT_CACHE })),
    ...GITA_CHAPTERS.map((c) => ({ url: `/api/purports/${c}`, cache: TEXT_CACHE })),
    { url: "/api/chapters/search", cache: TEXT_CACHE },
  ];
}

export function verseItems(references: readonly string[], sizes: Readonly<Record<string, number>>): PackItem[] {
  return references.map((reference) => ({ url: audioUrl(reference), cache: AUDIO_CACHE, bytes: sizes[reference] }));
}

export function chapterAudioItem(chapter: number, base?: string): PackItem | undefined {
  const track = CHAPTER_AUDIO.find((c) => c.chapter === chapter);
  return track && { url: chapterAudioUrl(track.key, base), cache: CHAPTER_AUDIO_CACHE, bytes: track.bytes };
}

/** All packs, in the order the Offline library shows them. */
export function buildPacks(options: { important: readonly string[]; all: readonly string[]; sizes: Readonly<Record<string, number>>; base?: string }): Pack[] {
  const chapters: Pack[] = CHAPTER_AUDIO.flatMap((track) => {
    const item = chapterAudioItem(track.chapter, options.base);
    return item ? [{ id: `chapter-${track.chapter}` as PackId, title: `Chapter ${track.chapter} · ${track.title}`, detail: formatLength(track.seconds), items: [item] }] : [];
  });
  return [
    { id: "essentials", title: "Essentials", detail: "All verse text, purports and search for the 18 chapters", items: textItems() },
    { id: "verses108", title: "108 verse audio", detail: "Every recording the learning loop uses", items: verseItems(options.important, options.sizes) },
    { id: "verses657", title: "All 657 verse audio", detail: "A recording for every verse of the Gita", items: verseItems(options.all, options.sizes) },
    ...chapters,
  ];
}

export type PackStatus = {
  /** Expected size of the whole pack (text files count as 0: they are small and their size is not known in advance). */
  totalBytes: number;
  savedBytes: number;
  savedCount: number;
  /** Files not saved yet. */
  missing: PackItem[];
  /** Saved files whose size no longer matches the current release: download again. */
  outdated: PackItem[];
  complete: boolean;
};

export function packStatus(pack: Pack, saved: SavedFiles): PackStatus {
  let totalBytes = 0, savedBytes = 0, savedCount = 0;
  const missing: PackItem[] = [], outdated: PackItem[] = [];
  for (const item of pack.items) {
    totalBytes += item.bytes ?? 0;
    const have = saved.get(item.url);
    if (have === undefined) { missing.push(item); continue; }
    savedCount++;
    if (item.bytes !== undefined && have !== item.bytes) outdated.push(item);
    else savedBytes += have;
  }
  return { totalBytes, savedBytes, savedCount, missing, outdated, complete: !missing.length && !outdated.length };
}

/** Files to fetch so the pack is complete and current. */
export const toDownload = (status: PackStatus) => [...status.missing, ...status.outdated];

/** Bytes a download still needs (unknown text sizes are estimated at 300 KB, which is above the largest chapter file). */
export const bytesNeeded = (items: readonly PackItem[]) => items.reduce((sum, item) => sum + (item.bytes ?? 300_000), 0);

/**
 * Whether `needed` bytes fit, keeping a 10% margin of the quota for the app shell and progress.
 * Unknown quota (older browsers) is treated as fitting: the download then stops cleanly if storage runs out.
 */
export function fitsInStorage(needed: number, estimate?: { quota?: number; usage?: number }) {
  if (!estimate?.quota) return true;
  return (estimate.usage ?? 0) + needed <= estimate.quota * 0.9;
}

export const formatMB = (bytes: number) => bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : `${Math.max(bytes ? 0.1 : 0, bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
