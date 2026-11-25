// Build the app icons from the ॐ glyph: public/icon.svg plus PNGs for the manifest, Apple and the favicon.
// Run: node scripts/build-icons.mjs   (uses the pre-installed Playwright Chromium to rasterise; dev only)
import { readFileSync, writeFileSync } from "node:fs";

const glyph = JSON.parse(readFileSync(new URL("./om-glyph.json", import.meta.url), "utf8"));
const [x0, y0, x1, y1] = glyph.bounds;

/** A square icon: gold tile with a dark-brown ॐ taking `share` of the height. */
export function iconSvg({ share = 0.56, rounded = false } = {}) {
  const size = 512, s = (size * share) / (y1 - y0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const radius = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Gita 108">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e3bd"/><stop offset="1" stop-color="#d4b273"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <path fill="#3f2c10" transform="translate(${size / 2} ${size / 2 + size * 0.01}) scale(${s.toFixed(5)} ${(-s).toFixed(5)}) translate(${-cx} ${-cy})" d="${glyph.d}"/>
</svg>
`;
}

const OUTPUTS = [
  // [file, pixel size, options]
  ["icon-192.png", 192, { share: 0.58 }],
  ["icon-512.png", 512, { share: 0.58 }],
  // Android crops maskable icons to a circle or squircle: keep the glyph inside the central safe zone.
  ["icon-maskable-192.png", 192, { share: 0.44 }],
  ["icon-maskable-512.png", 512, { share: 0.44 }],
  ["apple-touch-icon.png", 180, { share: 0.56 }],
  ["favicon-32.png", 32, { share: 0.7, rounded: true }],
  ["favicon-16.png", 16, { share: 0.74, rounded: true }],
];

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const { chromium } = await import("playwright");
  writeFileSync(new URL("../public/icon.svg", import.meta.url), iconSvg({ share: 0.58, rounded: true }));
  // CHROMIUM_PATH: point at a local Chrome when the bundled Playwright browser is not installed.
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  for (const [file, px, opts] of OUTPUTS) {
    await page.setViewportSize({ width: px, height: px });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${iconSvg(opts)}`);
    await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: true });
    console.log(`public/${file}`);
  }
  await browser.close();
}
