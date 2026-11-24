import type { Shloka } from "@/lib/shlokas";
import { GITA_CHAPTERS, type GitaVerse } from "@/lib/gita-verses";
import { VERSE_INDEX, indexCovering } from "@/lib/verse-index";

/** Normalized searchable text and the display spelling of the first line. */
export type VerseSearchEntry = readonly [reference: string, text: string, snippet: string];

/** Lowercase, drop diacritics (ś→s, ṛ→r) and collapse whitespace so "krsna", "krishna" and "Kṛṣṇa" meet. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/sh/g, "s").replace(/ri/g, "r").replace(/\s+/g, " ").trim();
}

/** "2.47", "2:47", "2 47", "BG 2.47" → "2.47"; anything else → null. A bare chapter ("2") is not a reference. */
export function parseReference(text: string): { chapter: number; verse: number } | null {
  const match = /^(?:bg\s*)?(\d{1,2})\s*[.:\s]\s*(\d{1,3})$/i.exec(text.trim());
  return match ? { chapter: Number(match[1]), verse: Number(match[2]) } : null;
}

/** Return local matches for complete and in-progress references, or null for a word query. */
export function findVerseReferences(text: string): Set<string> | null {
  const query = text.trim();
  const exact = parseReference(query);
  if (exact) {
    const index = indexCovering(exact.chapter, exact.verse);
    return new Set(index >= 0 ? [VERSE_INDEX[index].reference] : []);
  }

  if (/^bg$/i.test(query)) return new Set(VERSE_INDEX.map(({ reference }) => reference));
  const partial = /^(?:bg\s*)?(\d{1,2})(?:(?:\s*[.:]\s*|\s+)(\d{0,3})(?:\s*-\s*(\d{0,3}))?)?$/i.exec(query);
  if (!partial) return null;

  const chapter = Number(partial[1]);
  const rangePrefix = partial[3] === undefined ? null : `${chapter}.${Number(partial[2])}-${partial[3]}`;
  return new Set(VERSE_INDEX.filter((entry) => entry.chapter === chapter &&
    (rangePrefix === null || entry.reference.startsWith(rangePrefix))).map(({ reference }) => reference));
}

export function verseSearchEntry(verse: Pick<Shloka, "reference" | "english" | "tamil" | "transliteration" | "sanskrit">): VerseSearchEntry {
  const { reference, english, transliteration, tamil, sanskrit } = verse;
  return [reference, fold(`${reference} ${english} ${transliteration} ${tamil} ${sanskrit}`), transliteration.split("\n", 1)[0]];
}

export function findVerseWords(index: readonly VerseSearchEntry[], text: string): Set<string> {
  const needle = fold(text);
  return new Set(index.filter((entry) => entry[1].includes(needle)).map(([reference]) => reference));
}

let pendingIndex: Promise<VerseSearchEntry[]> | undefined;

/** The index is shared by picker instances. Clear failures to support explicit retry. */
export function loadVerseSearchIndex(): Promise<VerseSearchEntry[]> {
  pendingIndex ??= fetch("/api/chapters/search").then((response) => {
    if (!response.ok) throw new Error("Could not load the complete verse search index.");
    return response.json() as Promise<VerseSearchEntry[]>;
  }).catch((error) => {
    pendingIndex = undefined;
    throw error;
  });
  return pendingIndex;
}

/** Older installations may already have chapter text saved, even without the word index. */
export async function loadCachedVerseSearchEntries(): Promise<VerseSearchEntry[]> {
  if (!("caches" in globalThis)) return [];
  const chapters = await Promise.all(GITA_CHAPTERS.map(async (chapter) => {
    try {
      const response = await caches.match(`/api/chapters/${chapter}`);
      if (!response?.ok) return [];
      const verses: GitaVerse[] = await response.json();
      return verses.map(verseSearchEntry);
    } catch { return []; }
  }));
  return chapters.flat();
}
