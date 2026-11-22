// Parse docs/chapter-briefs.md into src/data/chapter-briefs.json (English + Tamil brief per chapter).
// Run: node scripts/build-chapter-briefs.mjs (a unit test fails when the JSON is stale)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(new URL("../docs/chapter-briefs.md", import.meta.url), "utf8");
// reference -> shloka id for the 108, so key verses can open the learning loop
const shlokas = readFileSync(new URL("../src/lib/shlokas.ts", import.meta.url), "utf8");
const idByRef = new Map([...shlokas.matchAll(/"id": "(GS-\d+)",[\s\S]*?"reference": "([^"]+)"/g)].map((m) => [m[2], m[1]]));

/** "★2.13 & ★2.20 (the eternal soul)" -> { refs: [{ ref, id? }], note } */
function keyVerse(text) {
  const note = text.match(/\(([^)]*)\)\s*$/)?.[1] ?? "";
  const refs = [...text.replace(/\([^)]*\)\s*$/, "").matchAll(/(★?)(\d+\.\d+(?:[–-]\d+)?)/g)].map(([, star, ref]) => {
    const id = star ? idByRef.get(ref) ?? idByRef.get(ref.split(/[–-]/)[0]) : undefined;
    if (star && !id) throw new Error(`★${ref} is not one of the 108`);
    return id ? { ref, id } : { ref };
  });
  if (!refs.length) throw new Error(`No verse in "${text}"`);
  return { refs, note };
}
const chapters = src.split(/^## /m).slice(1).filter((s) => /^\d+ ·/.test(s));

/** Split one language's text into its labelled parts. */
function parse(text) {
  const field = (label) => text.match(new RegExp(`\\*\\*${label}[.:]?\\*\\*:?\\s*([^\\n]+)`))?.[1].trim() ?? "";
  const list = (label) => {
    const block = text.split(new RegExp(`\\*\\*${label}\\*\\*`))[1]?.split(/\n\s*\n\*\*/)[0] ?? "";
    return block.split("\n").map((l) => l.replace(/^\s*(?:-|\d+\.)\s+/, "").trim()).filter((l, i, a) => l && a[i] !== "" && /\S/.test(l)).filter((l) => !l.startsWith("**"));
  };
  return {
    overview: field("(?:Overview|சுருக்கம்)"),
    quickRead: list("(?:Quick read|விரைவாகப் படிக்க)"),
    keyVerses: field("(?:Key verses|முக்கிய ஸ்லோகங்கள்)").split(" · ").map((v) => keyVerse(v.trim())),
    actions: list("(?:Action points|செயல் குறிப்புகள்)"),
    remember: field("(?:Remember|நினைவில் கொள்ள)"),
  };
}

export function buildChapterBriefs() {
  const briefs = chapters.map((block) => {
  const chapter = Number(block.match(/^(\d+)/)[1]);
  const [en, ta] = block.split("**தமிழ்**");
  const brief = { chapter, en: parse(en), ta: parse(ta) };
  for (const lang of ["en", "ta"]) {
    const b = brief[lang];
    if (!b.overview || b.quickRead.length < 3 || b.actions.length !== 3 || !b.remember || !b.keyVerses.length) throw new Error(`Chapter ${chapter} (${lang}) is incomplete`);
  }
  return brief;
});
  if (briefs.length !== 18) throw new Error(`Expected 18 chapters, found ${briefs.length}`);
  return briefs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const briefs = buildChapterBriefs();
  writeFileSync(new URL("../src/data/chapter-briefs.json", import.meta.url), JSON.stringify(briefs, null, 1) + "\n");
  console.log(`Wrote ${briefs.length} chapter briefs`);
}
