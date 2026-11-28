// Generates src/data/audio-sizes.json: the byte size of every verse recording, in reading order.
// The Offline library uses it to show pack sizes and to spot saved copies that are out of date
// (a file whose saved size no longer matches was re-encoded or replaced, so it is downloaded again).
// Run `node scripts/build-audio-sizes.mjs` after changing public/audio; a unit test fails when it is stale.
import { readFile, stat, writeFile } from "node:fs/promises";

export async function buildAudioSizes(root = ".") {
  const index = JSON.parse(await readFile(`${root}/src/data/verse-index.json`, "utf8"));
  const sizes = {};
  for (const [reference] of index) sizes[reference] = (await stat(`${root}/public/audio/${reference}.mp3`)).size;
  return sizes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sizes = await buildAudioSizes();
  await writeFile("src/data/audio-sizes.json", JSON.stringify(sizes) + "\n");
  console.log(`Wrote ${Object.keys(sizes).length} sizes to src/data/audio-sizes.json`);
}
