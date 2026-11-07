import type { Shloka } from "@/lib/shlokas";

/**
 * Every verse of the Gita, for browsing. The curated 108 (`important: true`) keep their
 * `GS-NNN` ids and drive the learning loop; the rest use `BG-<chapter>.<verse>` ids and are
 * read-only. Data is split per chapter and loaded on demand to keep the first bundle small.
 */
export type GitaVerse = Shloka & { important: boolean };

export const GITA_CHAPTERS = Array.from({ length: 18 }, (_, i) => i + 1);

const cache = new Map<number, Promise<GitaVerse[]>>();

export function loadChapter(chapter: number): Promise<GitaVerse[]> {
  if (!GITA_CHAPTERS.includes(chapter)) return Promise.reject(new Error(`Unknown chapter ${chapter}`));
  let pending = cache.get(chapter);
  if (!pending) {
    // Loading through the server keeps an unfinished chapter import from breaking
    // Turbopack/the learning screen while the independent dataset is prepared.
    pending = fetch(`/api/chapters/${chapter}`).then(async (response) => {
      if (!response.ok) {
        if (response.status === 503) throw new Error("This chapter is not available yet. You can keep practising the selected 108 verses.");
        throw new Error("Could not load this chapter. Please check your connection and try again.");
      }
      return response.json() as Promise<GitaVerse[]>;
    });
    pending.catch(() => cache.delete(chapter)); // allow retry after a failed (offline) load
    cache.set(chapter, pending);
  }
  return pending;
}

/** Load every chapter (in parallel) for cross-chapter search. Chapters that fail are reported, not fatal. */
export async function loadAllChapters(): Promise<{ verses: GitaVerse[]; failed: number[] }> {
  const results = await Promise.allSettled(GITA_CHAPTERS.map((c) => loadChapter(c)));
  const failed = GITA_CHAPTERS.filter((_, i) => results[i].status === "rejected");
  const verses = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { verses, failed };
}
