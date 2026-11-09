// Re-encodes chapter masters (audio-src/chapter-NN.ta.mp3) to speech-friendly 64 kbps mono MP3,
// writes them to public/chapter-audio/ (gitignored; upload this folder to R2), and regenerates
// src/data/chapter-audio.json with the real duration and size of every file.
// Usage: node scripts/build-chapter-audio.mjs [--force]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "audio-src");
const out = path.join(root, "public", "chapter-audio");
const metaFile = path.join(root, "src", "data", "chapter-audio.json");
const force = process.argv.includes("--force");
mkdirSync(out, { recursive: true });

const entries = [];
for (let chapter = 1; chapter <= 18; chapter++) {
  const key = `chapter-${String(chapter).padStart(2, "0")}.mp3`;
  const master = path.join(src, `chapter-${String(chapter).padStart(2, "0")}.ta.mp3`);
  const target = path.join(out, key);
  if (!existsSync(master)) { console.warn(`skip ${chapter}: no master`); continue; }
  if (force || !existsSync(target)) {
    console.log(`encoding ${key}…`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", master, "-vn", "-map_metadata", "-1", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k", target], { stdio: "inherit" });
  }
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", target]).toString().trim());
  entries.push({ chapter, key, seconds: Math.round(seconds), bytes: statSync(target).size });
}
const previous = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : [];
writeFileSync(metaFile, JSON.stringify(entries.length ? entries : previous, null, 1) + "\n");
console.log(`Wrote ${entries.length} entries to src/data/chapter-audio.json`);
