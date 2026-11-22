import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildChapterBriefs } from "../../../scripts/build-chapter-briefs.mjs";
import { SHLOKAS } from "../shlokas";

const committed = JSON.parse(readFileSync(join(process.cwd(), "src/data/chapter-briefs.json"), "utf8"));

describe("chapter briefs", () => {
  it("match docs/chapter-briefs.md, so they are never stale (run scripts/build-chapter-briefs.mjs to refresh)", () => {
    expect(committed).toEqual(buildChapterBriefs());
  });

  it("cover all 18 chapters in English and Tamil, and link only to real shlokas", () => {
    const ids = new Set(SHLOKAS.map((s) => s.id));
    expect(committed.map((b: { chapter: number }) => b.chapter)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    for (const b of committed) for (const lang of ["en", "ta"]) {
      expect(b[lang].actions).toHaveLength(3);
      expect(b[lang].keyVerses.length).toBe(b.en.keyVerses.length);
      for (const v of b[lang].keyVerses) for (const r of v.refs) if (r.id) expect(ids.has(r.id)).toBe(true);
    }
  });
});
