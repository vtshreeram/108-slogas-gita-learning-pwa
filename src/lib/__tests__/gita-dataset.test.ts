import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SHLOKAS } from "../shlokas";
import type { GitaVerse } from "../gita-verses";

const load = (c: number): GitaVerse[] =>
  JSON.parse(readFileSync(join(process.cwd(), "src/data/gita", `chapter-${c}.json`), "utf8"));
const all = Array.from({ length: 18 }, (_, i) => load(i + 1)).flat();

describe("full Gita dataset", () => {
  it("covers all 18 chapters with no duplicate references or ids", () => {
    expect(new Set(all.map((v) => v.chapter))).toEqual(new Set(Array.from({ length: 18 }, (_, i) => i + 1)));
    expect(new Set(all.map((v) => v.reference)).size).toBe(all.length);
    expect(new Set(all.map((v) => v.id)).size).toBe(all.length);
  });

  it("covers every verse number in each chapter exactly once (ranges expanded)", () => {
    const counts = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78]; // Gita Press numbering
    for (let c = 1; c <= 18; c++) {
      const covered: number[] = [];
      for (const v of load(c)) {
        const [, a, b] = v.reference.match(/^\d+\.(\d+)(?:-(\d+))?$/)!;
        for (let n = +a; n <= +(b ?? a); n++) covered.push(n);
      }
      // Prabhupada groups/merges a few verses (e.g. 13.1-2); coverage must still be gap-free and unique.
      expect(new Set(covered).size, `chapter ${c} duplicates`).toBe(covered.length);
      expect(Math.max(...covered), `chapter ${c} last verse`).toBeLessThanOrEqual(counts[c - 1]);
      expect(Math.min(...covered)).toBeLessThanOrEqual(1);
    }
    expect(all.length).toBeGreaterThan(550);
  });

  it("marks exactly the curated 108 as important, unchanged", () => {
    const important = all.filter((v) => v.important);
    expect(important).toHaveLength(108);
    for (const s of SHLOKAS) {
      const { important: flag, ...rest } = important.find((v) => v.id === s.id)!;
      expect(flag).toBe(true);
      expect(rest).toEqual(s);
    }
  });

  it("gives every verse the core fields", () => {
    for (const v of all) {
      expect(v.sanskrit, v.reference).toBeTruthy();
      expect(v.transliteration, v.reference).toBeTruthy();
      expect(v.english, v.reference).toBeTruthy();
      expect(v.tamil, v.reference).toBeTruthy();
      expect(v.translationAuthor).toBeTruthy();
    }
  });

  it("leaves non-important ids outside the GS namespace", () => {
    for (const v of all.filter((x) => !x.important)) expect(v.id).toMatch(/^BG-\d+\.\d+(-\d+)?$/);
  });
});
