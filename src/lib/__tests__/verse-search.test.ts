import { describe, it, expect } from "vitest";
import { filterVerses, parseReference, fold, countVerses } from "../verse-search";
import type { GitaVerse } from "../gita-verses";

const v = (chapter: number, verse: number, important: boolean, extra: Partial<GitaVerse> = {}, end?: number): GitaVerse => ({
  id: `BG-${chapter}.${verse}`, chapter, verse, reference: `${chapter}.${verse}${end ? `-${end}` : ""}`,
  sanskrit: "x", transliteration: "kṛṣṇa uvāca", tamil: "கிருஷ்ணர்", english: "Krishna spoke", translationAuthor: "a",
  reflectionPrompt: "", important, ...extra,
} as GitaVerse);
const data = [v(1, 1, false), v(2, 47, true, { english: "You have a right to action" }), v(2, 48, false), v(13, 1, false, {}, 2)];
const q = (text: string, filter: "all" | "important" | "others" = "all", chapter: number | null = null) => filterVerses(data, { text, filter, chapter }).map((x) => x.reference);

describe("verse search", () => {
  it("parses references in several spellings", () => {
    for (const t of ["2.47", "2:47", "2 47", "BG 2.47"]) expect(parseReference(t)).toEqual({ chapter: 2, verse: 47 });
    expect(parseReference("2")).toBeNull();
    expect(parseReference("action")).toBeNull();
  });
  it("finds a verse inside a merged range by reference", () => expect(q("13.2")).toEqual(["13.1-2"]));
  it("folds diacritics", () => { expect(fold("Kṛṣṇa Śrī")).toBe(fold("krishna shri")); expect(q("krsna")).toHaveLength(4); expect(q("krishna")).toHaveLength(4); });
  it("searches English and Tamil text", () => { expect(q("right to action")).toEqual(["2.47"]); expect(q("கிருஷ்ணர்")).toHaveLength(4); });
  it("filters important / others / chapter", () => {
    expect(q("", "important")).toEqual(["2.47"]);
    expect(q("", "others")).toHaveLength(3);
    expect(q("", "all", 2)).toEqual(["2.47", "2.48"]);
    expect(countVerses(data)).toEqual({ all: 4, important: 1, others: 3 });
  });
});
