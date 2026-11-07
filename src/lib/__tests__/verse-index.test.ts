import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildVerseIndex } from "../../../scripts/build-verse-index.mjs";
import { SHLOKAS } from "../shlokas";
import { VERSE_INDEX, VERSES_BY_CHAPTER, hasPurport, indexCovering, indexOfReference } from "../verse-index";
import type { GitaVerse } from "../gita-verses";

describe("verse index", () => {
  it("matches the chapter and purport data, so it is never stale (run scripts/build-verse-index.mjs to refresh)", async () => {
    const committed = JSON.parse(readFileSync(join(process.cwd(), "src/data/verse-index.json"), "utf8"));
    expect(committed).toEqual(await buildVerseIndex());
  });

  it("lists all 657 verses in reading order, and exactly the curated 108 as important", () => {
    expect(VERSE_INDEX).toHaveLength(657);
    expect(VERSE_INDEX.filter((e) => e.important).map((e) => e.reference).sort()).toEqual(SHLOKAS.map((s) => s.reference).sort());
    expect([...VERSES_BY_CHAPTER.keys()]).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    for (let c = 1; c <= 18; c++) {
      const data: GitaVerse[] = JSON.parse(readFileSync(join(process.cwd(), "src/data/gita", `chapter-${c}.json`), "utf8"));
      expect(VERSES_BY_CHAPTER.get(c)!.map((e) => e.reference)).toEqual(data.map((v) => v.reference));
    }
  });

  it("finds verses inside combined entries, and neighbours step across chapter boundaries", () => {
    const combined = VERSE_INDEX[indexCovering(1, 17)];
    expect(combined.reference).toBe("1.16-18");
    expect(indexCovering(1, 999)).toBe(-1);
    const last = VERSES_BY_CHAPTER.get(1)!.at(-1)!;
    expect(VERSE_INDEX[indexOfReference(last.reference) + 1].chapter).toBe(2);
  });

  it("flags purports consistently with the data", () => {
    expect(hasPurport("1.1", "en")).toBe(true);
    expect(hasPurport("1.1", "ta")).toBe(true);
    expect(hasPurport("nope", "en")).toBe(false);
  });
});
