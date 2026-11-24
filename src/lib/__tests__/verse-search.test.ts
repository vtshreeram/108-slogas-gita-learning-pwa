import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/chapters/search/route";
import { GITA_CHAPTERS, type GitaVerse } from "../gita-verses";
import { VERSE_INDEX } from "../verse-index";
import { findVerseReferences, findVerseWords, fold, loadCachedVerseSearchEntries, parseReference, type VerseSearchEntry } from "../verse-search";

afterEach(() => vi.unstubAllGlobals());

describe("verse search", () => {
  it("parses references in several spellings", () => {
    for (const text of ["2.47", "2:47", "2 47", "BG 2.47"]) {
      expect(parseReference(text)).toEqual({ chapter: 2, verse: 47 });
      expect(findVerseReferences(text)).toEqual(new Set(["2.47"]));
    }
    expect(parseReference("2")).toBeNull();
    expect(findVerseReferences("right to action")).toBeNull();
  });

  it("searches partial and combined references using only the local index", () => {
    const chapterTwo = new Set(VERSE_INDEX.filter((entry) => entry.chapter === 2).map((entry) => entry.reference));
    for (const text of ["2", "2.", "2:", "BG 2."]) expect(findVerseReferences(text)).toEqual(chapterTwo);
    for (const text of ["1.17", "1.16-", "1.16-18"]) expect(findVerseReferences(text)).toEqual(new Set(["1.16-18"]));
    expect(findVerseReferences("2.999")).toEqual(new Set());
    expect(findVerseReferences("BG")?.size).toBe(VERSE_INDEX.length);
  });

  it("folds transliteration and preserves multilingual matches and snippets across the whole index", async () => {
    const chapters: GitaVerse[][] = await Promise.all(
      GITA_CHAPTERS.map(async (chapter) => JSON.parse(await readFile(`src/data/gita/chapter-${chapter}.json`, "utf8")) as GitaVerse[]),
    );
    const verses = chapters.flat();
    const response = await GET();
    expect(response.ok).toBe(true);
    const entries: VerseSearchEntry[] = await response.json();
    expect(entries.map(([reference, , snippet]) => [reference, snippet])).toEqual(
      verses.map((verse) => [verse.reference, verse.transliteration.split("\n", 1)[0]]),
    );
    expect(fold("Kṛṣṇa Śrī")).toBe(fold("krishna shri"));
    for (const text of ["right to perform", "eyes full of tears", "கிருஷ்ணர்", "कुरुक्षेत्रे", "krishna", "Kṛṣṇa"]) {
      const needle = fold(text);
      const expected = verses.filter((verse) =>
        fold(`${verse.reference} ${verse.english} ${verse.transliteration} ${verse.tamil} ${verse.sanskrit}`).includes(needle),
      ).map((verse) => verse.reference);
      expect(expected.length).toBeGreaterThan(0);
      expect(findVerseWords(entries, text)).toEqual(new Set(expected));
    }
  });

  it("searches chapter text cached before the full index was available without making network requests", async () => {
    const chapter = await readFile("src/data/gita/chapter-2.json", "utf8");
    const match = vi.fn(async (path: string) => path === "/api/chapters/2" ? new Response(chapter) : undefined);
    const fetch = vi.fn();
    vi.stubGlobal("caches", { match });
    vi.stubGlobal("fetch", fetch);

    const index = await loadCachedVerseSearchEntries();
    expect(findVerseWords(index, "eyes full of tears")).toEqual(new Set(["2.1"]));
    expect(index.find(([reference]) => reference === "2.1")?.[2]).toBe("sañjaya uvāca");
    expect(fetch).not.toHaveBeenCalled();
  });
});
