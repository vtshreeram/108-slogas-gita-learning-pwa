import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { purportResponse } from "../server/purports";
import type { Purport } from "../gita-verses";

describe("purports", () => {
  const data: Record<string, Purport> = JSON.parse(readFileSync(join(process.cwd(), "src/data/purports/chapter-1.json"), "utf8"));

  it("has English and Tamil paragraphs for 1.1, with the proofread Tamil paragraph marked verified", () => {
    expect(data["1.1"].en).toHaveLength(4);
    expect(data["1.1"].ta!.length).toBeGreaterThanOrEqual(4);
    expect(data["1.1"].ta![0].verified).toBe(true);
    expect(data["1.1"].ta!.slice(1).every((p) => !p.verified)).toBe(true);
    for (const p of data["1.1"].ta!) expect(p.text).toMatch(/[஀-௿]/);
  });

  it("serves a chapter, and an empty object when a chapter has no purports yet", async () => {
    expect(Object.keys(await (await purportResponse("1")).json())).toContain("1.1");
    const missing = async () => { throw Object.assign(new Error("nope"), { code: "ENOENT" }); };
    expect(await (await purportResponse("2", missing)).json()).toEqual({});
    expect((await purportResponse("19")).status).toBe(400);
  });

  it("covers the whole Gita: every verse has an English purport except the few the book leaves out", () => {
    const all: Record<string, Purport> = {};
    for (let c = 1; c <= 18; c++) Object.assign(all, JSON.parse(readFileSync(join(process.cwd(), "src/data/purports", `chapter-${c}.json`), "utf8")));
    const verses = Array.from({ length: 18 }, (_, i) => JSON.parse(readFileSync(join(process.cwd(), "src/data/gita", `chapter-${i + 1}.json`), "utf8")) as { reference: string }[]).flat();
    const without = verses.filter((v) => !all[v.reference]?.en?.length);
    expect(verses).toHaveLength(657);
    expect(without.length).toBeLessThan(40);
    for (const p of Object.values(all)) for (const t of p.en ?? []) expect(t).not.toMatch(/\/\/|\[\[|\{\{|\*\*|<[a-z]/);
  });

  it("marks machine-corrected Tamil purports, keeps hand-verified paragraphs, and leaves no OCR debris in corrected text", () => {
    let corrected = 0;
    for (let c = 1; c <= 18; c++) {
      const data: Record<string, Purport> = JSON.parse(readFileSync(join(process.cwd(), "src/data/purports", `chapter-${c}.json`), "utf8"));
      for (const [ref, p] of Object.entries(data)) for (const para of p.ta ?? []) {
        expect(para.text.trim(), ref).not.toBe("");
        if (para.corrected) { corrected++; expect(para.text, ref).not.toMatch(/[A-Za-z]|[\u0BBE-\u0BCD]{2}|[\u0BE6-\u0BEF]/); }
      }
    }
    expect(corrected).toBeGreaterThan(1500);
    expect(data["1.1"].ta![0]).toEqual(expect.objectContaining({ verified: true }));
  });
});
