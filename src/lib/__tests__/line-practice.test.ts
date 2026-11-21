import { describe, expect, it } from "vitest";
import { SHLOKAS } from "@/lib/shlokas";
import { DEFAULT_LINE_CUES, recallHintLines, resolveLineCues, validLineCues } from "@/lib/line-practice";

describe("default line cues", () => {
  it("provides valid built-in cues for all 108 shlokas", () => {
    expect(Object.keys(DEFAULT_LINE_CUES)).toHaveLength(SHLOKAS.length);
    for (const shloka of SHLOKAS) {
      const lines = shloka.transliteration.split("\n").filter((l) => l.trim());
      const cues = DEFAULT_LINE_CUES[shloka.id];
      expect(cues, `missing cues for ${shloka.id}`).toBeDefined();
      const duration = cues[cues.length - 1];
      expect(validLineCues(cues, lines.length, duration), `invalid cues for ${shloka.id}`).toBe(true);
    }
  });

  it("prefers user-marked cues over built-in defaults", () => {
    const id = SHLOKAS[0].id;
    const custom = [0, 1.5, 3, 4.5, 6, 8];
    expect(resolveLineCues(custom, id)).toEqual(custom);
    expect(resolveLineCues(undefined, id)).toEqual(DEFAULT_LINE_CUES[id]);
  });
});

describe("recallHintLines", () => {
  const sample = "karmaṇy evādhikāras te\nmā phaleṣu kadācana\nmā karma-phala-hetur bhūr";

  it("returns null for all lines before any hint is requested", () => {
    expect(recallHintLines(sample, 0, false)).toEqual([null, null, null]);
  });

  it("shows only the first word of unrevealed lines when first-word hints are enabled", () => {
    expect(recallHintLines(sample, 0, true)).toEqual([
      "karmaṇy …",
      "mā …",
      "mā …",
    ]);
  });

  it("combines revealed lines with first-word hints for remaining lines", () => {
    expect(recallHintLines(sample, 1, false)).toEqual([
      "karmaṇy evādhikāras te",
      null,
      null,
    ]);
    expect(recallHintLines(sample, 1, true)).toEqual([
      "karmaṇy evādhikāras te",
      "mā …",
      "mā …",
    ]);
  });
});
