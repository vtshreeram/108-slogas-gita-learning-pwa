import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SHLOKAS, TOTAL_SHLOKAS, DAILY_TARGET, tamilCredit, TAMIL_TRANSLATION_AUTHOR } from "../shlokas";

describe("shloka dataset", () => {
  it("has the expected number of entries", () => {
    expect(SHLOKAS.length).toBe(TOTAL_SHLOKAS);
    expect(TOTAL_SHLOKAS).toBe(108);
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
      expect(s.tamil).toBeTruthy();
      expect(s.translationAuthor).toBeTruthy();
    }
  });

  it("has valid GS-NNN IDs", () => {
    SHLOKAS.forEach((s) => {
      expect(s.id).toMatch(/^GS-\d{3}$/);
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

  it("keeps chapter and verse aligned with each reference", () => {
    for (const s of SHLOKAS) {
      expect(s.reference).toMatch(new RegExp(`^${s.chapter}\\.${s.verse}(?:-\\d+)?$`));
    }
  });

  it("contains readable Tamil meanings without the former OCR contamination", () => {
    for (const s of SHLOKAS) {
      expect(s.tamil, s.reference).toMatch(/[\u0B80-\u0BFF]/);
      expect(s.tamil, s.reference).toBe(s.tamil.normalize("NFC"));
      expect(s.tamil, s.reference).not.toMatch(/க்ஷபோ|க்ஷவண்|தகோண்|தசய்த|\uFFFD|This file|<[^>]+>/);
    }
  });

  it("does not display scraped numbering or escape characters in English", () => {
    for (const s of SHLOKAS) {
      expect(s.english, s.reference).not.toMatch(/^\d+\.\d+|\\[\[\]]|purifled|progrese|conquerer/);
    }
  });

  it("takes Tamil from the book unless it is flagged, and records the source per verse", () => {
    const report = JSON.parse(readFileSync(join(process.cwd(), "scripts/data/tamil-book.json"), "utf8"));
    for (const s of SHLOKAS) {
      const r = report[s.reference];
      expect(s.tamilSource, s.reference).toBe(r.status === "ok" ? "book" : "bharati");
      expect(s.tamil, s.reference).toBe(r.text);
      if (s.tamilSource === "book") expect(s.tamil, s.reference).not.toMatch(/[A-Za-z0-9|]/);
    }
  });

  it("credits each verse's Tamil to the right source", () => {
    expect(tamilCredit({ tamilSource: "book" }).href).toBeUndefined();
    expect(tamilCredit({ tamilSource: "bharati" }).href).toContain("projectmadurai");
    expect(tamilCredit({}).label).toBe(TAMIL_TRANSLATION_AUTHOR);
  });
});
