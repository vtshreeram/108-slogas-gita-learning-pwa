import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_COLORS } from "../theme-colors";

const pub = (file: string) => join(process.cwd(), "public", file.replace(/^\//, ""));
const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));
/** Width and height from a PNG's IHDR chunk. */
const pngSize = (file: string) => { const b = readFileSync(pub(file)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

describe("PWA assets", () => {
  it("uses the dark page background for the Android splash and bars", () => {
    expect(manifest.background_color).toBe(THEME_COLORS.dark);
    expect(manifest.theme_color).toBe(THEME_COLORS.dark);
  });

  it("keeps the theme colours in step with the page background in globals.css", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain(`--background: ${THEME_COLORS.light};`);
    expect(css).toContain(`--background: ${THEME_COLORS.dark};`);
  });

  it("ships every manifest icon at its declared size, with separate maskable icons", () => {
    for (const icon of manifest.icons.filter((i: { type: string }) => i.type === "image/png")) {
      const [w, h] = pngSize(icon.src);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    const maskable = manifest.icons.filter((i: { purpose: string }) => i.purpose === "maskable").map((i: { src: string }) => i.src);
    const regular = manifest.icons.filter((i: { purpose: string }) => i.purpose === "any").map((i: { src: string }) => i.src);
    expect(maskable.length).toBeGreaterThan(0);
    expect(maskable.some((src: string) => regular.includes(src))).toBe(false);
    expect(pngSize("apple-touch-icon.png")).toEqual([180, 180]);
  });
});
