import type { Shloka } from "@/lib/shlokas";

/**
 * Every verse of the Gita, for browsing. The curated 108 (`important: true`) keep their
 * `GS-NNN` ids and drive the learning loop; the rest use `BG-<chapter>.<verse>` ids and are
 * read-only. Chapter text is split per chapter and fetched only when a verse from it is opened;
 * the picker and navigation use the reference-only `verse-index` instead of downloading chapters.
 */
export type GitaVerse = Shloka & { important: boolean };

export const GITA_CHAPTERS = Array.from({ length: 18 }, (_, i) => i + 1);

/**
 * Shared loader for per-chapter JSON: de-duplicates in-flight and finished requests, caps how many run
 * at once, and forgets failures so a later call retries. `signal` only stops *this caller* waiting; the
 * request itself keeps going so other callers and the cache still get the result.
 */
export type JsonLoader<T> = (chapter: number, signal?: AbortSignal) => Promise<T>;

export function createChapterLoader<T>(options: {
  url: (chapter: number) => string;
  /** Maps a failed response to the message shown to the learner. */
  failure: (status: number) => string;
  offlineMessage: string;
  concurrency?: number;
  fetchImpl?: typeof fetch;
}): JsonLoader<T> & { clear: () => void } {
  const limit = options.concurrency ?? 3;
  const cache = new Map<number, Promise<T>>();
  const waiting: (() => void)[] = [];
  let running = 0;

  const slot = () => new Promise<void>((resolve) => {
    const start = () => { running++; resolve(); };
    if (running < limit) start(); else waiting.push(start);
  });
  const release = () => { running--; waiting.shift()?.(); };

  const request = async (chapter: number): Promise<T> => {
    await slot();
    try {
      let response: Response;
      try { response = await (options.fetchImpl ?? fetch)(options.url(chapter)); }
      catch { throw new Error(options.offlineMessage); }
      if (!response.ok) throw new Error(options.failure(response.status));
      try { return (await response.json()) as T; }
      catch { throw new Error(options.offlineMessage); } // the connection dropped mid-download
    } finally { release(); }
  };

  const load: JsonLoader<T> = (chapter, signal) => {
    if (!GITA_CHAPTERS.includes(chapter)) return Promise.reject(new Error(`Unknown chapter ${chapter}`));
    let pending = cache.get(chapter);
    if (!pending) {
      pending = request(chapter);
      cache.set(chapter, pending);
      pending.catch(() => { if (cache.get(chapter) === pending) cache.delete(chapter); }); // a failed load can be retried
    }
    if (!signal) return pending;
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(new DOMException("Cancelled", "AbortError"));
      if (signal.aborted) return abort();
      signal.addEventListener("abort", abort, { once: true });
      pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  };
  return Object.assign(load, { clear: () => cache.clear() });
}

export const loadChapter = createChapterLoader<GitaVerse[]>({
  // Loading through the server keeps an unfinished chapter import from breaking
  // Turbopack/the learning screen while the independent dataset is prepared.
  url: (chapter) => `/api/chapters/${chapter}`,
  failure: (status) => status === 503 ? "This chapter is not available yet. You can keep practising the selected 108 verses."
    : status === 504 ? "You are offline and this chapter has not been downloaded yet. Connect once to use it offline."
    : "Could not load this chapter. Please check your connection and try again.",
  offlineMessage: "You are offline and this chapter has not been downloaded yet. Connect once to use it offline.",
});

/** Load every chapter (at most three at a time). Nothing in the learning flow needs this; it is for future full-text search. */
export async function loadAllChapters(): Promise<{ verses: GitaVerse[]; failed: number[] }> {
  const results = await Promise.allSettled(GITA_CHAPTERS.map((c) => loadChapter(c)));
  const failed = GITA_CHAPTERS.filter((_, i) => results[i].status === "rejected");
  const verses = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { verses, failed };
}

export type Purport = {
  /** English purport paragraphs (Prabhupada). */
  en?: string[];
  /** Tamil purport paragraphs. `verified` = human-proofread; `corrected` = machine-corrected OCR; neither = raw OCR. */
  ta?: { text: string; verified: boolean; corrected?: boolean }[];
};

/** Purports for one chapter, keyed by verse reference. Fetched when a learner opens a purport, then kept for the session. */
export const loadPurports = createChapterLoader<Record<string, Purport>>({
  url: (chapter) => `/api/purports/${chapter}`,
  failure: () => "Could not load the purport. Please check your connection and try again.",
  offlineMessage: "You are offline and this purport has not been downloaded yet. Open it once while online to read it offline.",
});
