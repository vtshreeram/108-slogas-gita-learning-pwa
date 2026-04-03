import { describe, it, expect } from "vitest";
import { SHLOKAS, TOTAL_SHLOKAS, DAILY_TARGET } from "../shlokas";

describe("shloka dataset", () => {
  it("has the expected number of entries", () => {
    expect(SHLOKAS.length).toBe(TOTAL_SHLOKAS);
    expect(TOTAL_SHLOKAS).toBeGreaterThanOrEqual(107);
  });

  it("has no duplicate IDs", () => {
    const ids = SHLOKAS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate references", () => {
    const refs = SHLOKAS.map((s) => s.reference);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("has all required fields on every entry", () => {
    for (const s of SHLOKAS) {
      expect(s.id).toBeTruthy();
      expect(s.chapter).toBeGreaterThan(0);
      expect(s.verse).toBeGreaterThan(0);
      expect(s.reference).toBeTruthy();
      expect(s.sanskrit).toBeTruthy();
      expect(s.transliteration).toBeTruthy();
      expect(s.english).toBeTruthy();
      expect(s.translationAuthor).toBeTruthy();
    }
  });

  it("has IDs in sequential GS-NNN format", () => {
    SHLOKAS.forEach((s, i) => {
      const expected = `GS-${String(i + 1).padStart(3, "0")}`;
      expect(s.id).toBe(expected);
    });
  });

  it("has audio paths in /audio/*.mp3 format", () => {
    for (const s of SHLOKAS) {
      if (s.audioSrc) {
        expect(s.audioSrc).toMatch(/^\/audio\/[\d.]+\.mp3$/);
      }
    }
  });

  it("has a positive daily target", () => {
    expect(DAILY_TARGET).toBeGreaterThan(0);
  });
});
