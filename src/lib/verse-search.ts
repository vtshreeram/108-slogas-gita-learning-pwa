import type { GitaVerse } from "@/lib/gita-verses";

export type VerseFilter = "all" | "important" | "others";

export type VerseQuery = {
  text: string;
  filter: VerseFilter;
  /** Restrict to one chapter (1–18); null for every chapter. */
  chapter: number | null;
};

/** Lowercase, drop diacritics (ś→s, ṛ→r) and collapse whitespace so "krsna", "krishna" and "Kṛṣṇa" meet. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/sh/g, "s").replace(/ri/g, "r").replace(/\s+/g, " ").trim();
}

/** "2.47", "2:47", "2 47", "BG 2.47" → "2.47"; anything else → null. A bare chapter ("2") is not a reference. */
export function parseReference(text: string): { chapter: number; verse: number } | null {
  const m = /^(?:bg\s*)?(\d{1,2})\s*[.:\s]\s*(\d{1,3})$/i.exec(text.trim());
  return m ? { chapter: Number(m[1]), verse: Number(m[2]) } : null;
}

function coversVerse(v: GitaVerse, chapter: number, verse: number): boolean {
  if (v.chapter !== chapter) return false;
  const end = Number(v.reference.split("-")[1]) || v.verse;
  return verse >= v.verse && verse <= end;
}

export function filterVerses(verses: GitaVerse[], { text, filter, chapter }: VerseQuery): GitaVerse[] {
  const ref = parseReference(text);
  const needle = ref ? "" : fold(text);
  return verses.filter((v) => {
    if (chapter !== null && v.chapter !== chapter) return false;
    if (filter === "important" && !v.important) return false;
    if (filter === "others" && v.important) return false;
    if (ref) return coversVerse(v, ref.chapter, ref.verse);
    if (!needle) return true;
    return fold(`${v.reference} ${v.english} ${v.transliteration} ${v.tamil} ${v.sanskrit}`).includes(needle);
  });
}

export function countVerses(verses: GitaVerse[]): { all: number; important: number; others: number } {
  const important = verses.filter((v) => v.important).length;
  return { all: verses.length, important, others: verses.length - important };
}
