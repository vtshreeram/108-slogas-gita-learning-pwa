// Generates src/data/verse-index.json: one compact [reference, flags] pair per verse, in reading order.
// flags: 1 = one of the 108, 2 = has an English purport, 4 = has a Tamil purport.
// The verse picker and the purport button read this instead of downloading all chapters.
// Run `node scripts/build-verse-index.mjs` after changing src/data/gita or src/data/purports;
// a unit test fails when the committed index is stale.
import { readFile, writeFile } from "node:fs/promises";

export async function buildVerseIndex(root = ".") {
  const index = [];
  for (let chapter = 1; chapter <= 18; chapter++) {
    const verses = JSON.parse(await readFile(`${root}/src/data/gita/chapter-${chapter}.json`, "utf8"));
    const purports = JSON.parse(await readFile(`${root}/src/data/purports/chapter-${chapter}.json`, "utf8").catch(() => "{}"));
    for (const v of verses) {
      const p = purports[v.reference];
      index.push([v.reference, (v.important ? 1 : 0) | (p?.en?.length ? 2 : 0) | (p?.ta?.length ? 4 : 0)]);
    }
  }
  return index;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = await buildVerseIndex();
  await writeFile("src/data/verse-index.json", JSON.stringify(index) + "\n");
  console.log(`Wrote ${index.length} verses to src/data/verse-index.json`);
}
