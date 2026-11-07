import { describe, it, expect } from "vitest";
import { SHLOKAS, TOTAL_SHLOKAS, DAILY_TARGET } from "../shlokas";

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

  it("includes both verses of Arjuna's declaration in 10.12–13", () => {
    const tamil = SHLOKAS.find((s) => s.reference === "10.12-13")!.tamil;
    expect(tamil).toContain("பரப்பிரம்மம்");
    expect(tamil).toContain("நாரத");
    expect(tamil).toContain("வியாச");
    expect(tamil.split("\n")).toHaveLength(2);
  });

  it("corrects source errors that reverse or omit the Tamil teaching", () => {
    const tamil = (reference: string) => SHLOKAS.find((s) => s.reference === reference)!.tamil;
    expect(tamil("4.34")).toContain("கேள்வி");
    expect(tamil("7.25")).toContain("யோகமாயையால் மறைக்கப்பட்டிருப்பதால்");
    expect(tamil("15.15")).toContain("வேதங்களாலும்");
    expect(tamil("18.65")).toContain("என்னை வழிபடு; என்னை வணங்கு");
    expect(tamil("18.68")).toContain("எடுத்துரைப்பவன்");
  });
});
