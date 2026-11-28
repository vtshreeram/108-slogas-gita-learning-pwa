import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAudioSizes } from "../../../scripts/build-audio-sizes.mjs";
import sizes from "@/data/audio-sizes.json";
import { SHLOKAS } from "../shlokas";
import { VERSE_INDEX } from "../verse-index";
import { CHAPTER_AUDIO } from "../chapter-audio";
import { buildPacks, bytesNeeded, fitsInStorage, formatMB, packStatus, textItems, toDownload, type Pack } from "../offline-packs";

const packs = buildPacks({ important: SHLOKAS.map((s) => s.reference), all: VERSE_INDEX.map((v) => v.reference), sizes, base: "https://audio.test" });
const byId = (id: string) => packs.find((p) => p.id === id)!;

describe("audio sizes", () => {
  it("match the files in public/audio, so they are never stale (run scripts/build-audio-sizes.mjs to refresh)", async () => {
    const committed = JSON.parse(readFileSync(join(process.cwd(), "src/data/audio-sizes.json"), "utf8"));
    expect(committed).toEqual(await buildAudioSizes());
  });
});

describe("offline packs", () => {
  it("offers Essentials, the 108, all 657 and one pack per chapter recording", () => {
    expect(packs.map((p) => p.id).slice(0, 3)).toEqual(["essentials", "verses108", "verses657"]);
    expect(byId("essentials").items).toHaveLength(37); // 18 chapters + 18 purports + search
    expect(byId("verses108").items).toHaveLength(108);
    expect(byId("verses657").items).toHaveLength(657);
    expect(packs.filter((p) => p.id.startsWith("chapter-"))).toHaveLength(CHAPTER_AUDIO.length);
    expect(byId("chapter-2").items[0]).toMatchObject({ url: "https://audio.test/chapter-02.mp3", cache: "gita-chapter-audio-v1" });
    expect(byId("verses108").items.every((i) => i.bytes! > 0)).toBe(true);
  });

  it("reports what is saved, missing and out of date", () => {
    const pack: Pack = { id: "verses108", title: "t", detail: "d", items: [{ url: "/audio/a.mp3", cache: "c", bytes: 100 }, { url: "/audio/b.mp3", cache: "c", bytes: 200 }, { url: "/audio/c.mp3", cache: "c", bytes: 300 }] };
    const status = packStatus(pack, new Map([["/audio/a.mp3", 100], ["/audio/b.mp3", 999]]));
    expect(status).toMatchObject({ totalBytes: 600, savedBytes: 100, savedCount: 2, complete: false });
    expect(status.missing.map((i) => i.url)).toEqual(["/audio/c.mp3"]);
    expect(status.outdated.map((i) => i.url)).toEqual(["/audio/b.mp3"]);
    expect(toDownload(status).map((i) => i.url)).toEqual(["/audio/c.mp3", "/audio/b.mp3"]);
    expect(packStatus(pack, new Map([["/audio/a.mp3", 100], ["/audio/b.mp3", 200], ["/audio/c.mp3", 300]])).complete).toBe(true);
  });

  it("treats text as saved by presence, since its size is not known in advance", () => {
    const essentials = byId("essentials");
    const all = new Map(textItems().map((i) => [i.url, 0]));
    expect(packStatus(essentials, all).complete).toBe(true);
    expect(bytesNeeded(textItems())).toBe(37 * 300_000);
  });

  it("checks storage with a margin, and allows downloads when the browser does not say", () => {
    expect(fitsInStorage(100, { quota: 1000, usage: 700 })).toBe(true);
    expect(fitsInStorage(250, { quota: 1000, usage: 700 })).toBe(false);
    expect(fitsInStorage(10 ** 12, undefined)).toBe(true);
    expect(fitsInStorage(10 ** 12, { usage: 5 })).toBe(true);
  });

  it("formats sizes for people", () => {
    expect(formatMB(0)).toBe("0.0 MB");
    expect(formatMB(5_400_000)).toBe("5.4 MB");
    expect(formatMB(144_000_000)).toBe("144 MB");
    expect(formatMB(1_500_000_000)).toBe("1.5 GB");
  });
});
