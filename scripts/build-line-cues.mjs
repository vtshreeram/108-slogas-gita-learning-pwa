#!/usr/bin/env node
/**
 * Generate default line-by-line cue timestamps for all 108 shloka recordings.
 * Uses ffprobe for duration and ffmpeg silencedetect for breath/line pauses,
 * falling back to proportional character-length splits when background audio
 * (e.g. tanpura) masks internal silences.
 *
 * Output: src/data/line-cues.json
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SHLOKAS_PATH = path.join(ROOT, "src/lib/shlokas.ts");
const OUT_PATH = path.join(ROOT, "src/data/line-cues.json");

function loadShlokas() {
  const src = fs.readFileSync(SHLOKAS_PATH, "utf8");
  const marker = "export const SHLOKAS: Shloka[] = ";
  const start = src.indexOf(marker);
  if (start === -1) throw new Error("Could not find SHLOKAS array in src/lib/shlokas.ts");
  const jsonStart = src.indexOf("[", start + marker.length);
  const jsonEnd = src.lastIndexOf("];");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("Could not parse SHLOKAS bounds");
  return JSON.parse(src.slice(jsonStart, jsonEnd + 1));
}

function probeDuration(filePath) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
    { encoding: "utf8" }
  ).trim();
  const duration = Number(out);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid duration for ${filePath}: ${out}`);
  }
  return duration;
}

function getSilenceIntervals(filePath) {
  const res = spawnSync(
    "ffmpeg",
    ["-i", filePath, "-af", "silencedetect=noise=-24dB:d=0.18", "-f", "null", "-"],
    { encoding: "utf8" }
  );
  const text = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
  const intervals = [];
  let currentStart = null;
  for (const line of text.split(/\r?\n/)) {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
    if (startMatch) {
      currentStart = Number(startMatch[1]);
      continue;
    }
    const endMatch = line.match(/silence_end:\s*([0-9.]+)/);
    if (endMatch && currentStart !== null) {
      const end = Number(endMatch[1]);
      if (Number.isFinite(currentStart) && Number.isFinite(end) && end > currentStart) {
        intervals.push({ start: currentStart, end, mid: (currentStart + end) / 2, dur: end - currentStart });
      }
      currentStart = null;
    }
  }
  return intervals;
}

const round2 = (n) => Math.round(n * 100) / 100;

function computeCues(lines, duration, silences) {
  const lineCount = lines.length;
  if (lineCount <= 1) return [0, round2(duration)];

  // Identify leading/trailing silence to anchor proportional estimates on active speech
  let activeStart = 0;
  let activeEnd = duration;
  const internalMidpoints = [];

  for (const s of silences) {
    if (s.start <= 0.15 && s.end < duration * 0.25) {
      activeStart = Math.max(activeStart, s.end);
    } else if (s.end >= duration - 0.15 && s.start > duration * 0.75) {
      activeEnd = Math.min(activeEnd, s.start);
    } else if (s.mid > 0.25 && s.mid < duration - 0.25) {
      internalMidpoints.push(s);
    }
  }

  if (activeEnd - activeStart < lineCount * 0.3) {
    activeStart = 0;
    activeEnd = duration;
  }

  const lengths = lines.map((l) => Math.max(1, l.replace(/\s+/g, "").length));
  const totalChars = lengths.reduce((a, b) => a + b, 0);
  const avgLineDur = (activeEnd - activeStart) / lineCount;
  const maxSnapDist = Math.max(0.6, avgLineDur * 0.35);

  const cues = [0];
  let cumChars = 0;
  const usedMidpoints = new Set();

  for (let i = 0; i < lineCount - 1; i++) {
    cumChars += lengths[i];
    const target = activeStart + (activeEnd - activeStart) * (cumChars / totalChars);
    const minAllowed = cues[cues.length - 1] + 0.15;
    const maxAllowed = duration - 0.15 * (lineCount - 1 - i);

    let best = null;
    let bestDist = Infinity;
    for (let j = 0; j < internalMidpoints.length; j++) {
      if (usedMidpoints.has(j)) continue;
      const mid = internalMidpoints[j].mid;
      if (mid <= minAllowed || mid >= maxAllowed) continue;
      const dist = Math.abs(mid - target);
      if (dist <= maxSnapDist && dist < bestDist) {
        best = { j, mid };
        bestDist = dist;
      }
    }

    if (best) {
      usedMidpoints.add(best.j);
      cues.push(round2(best.mid));
    } else {
      const clamped = Math.min(maxAllowed, Math.max(minAllowed, target));
      cues.push(round2(clamped));
    }
  }

  cues.push(round2(duration));
  return cues;
}

const shlokas = loadShlokas();
const result = {};
let snappedTotal = 0;
let boundaryTotal = 0;

for (const s of shlokas) {
  const audioPath = path.join(ROOT, "public/audio", `${s.reference}.mp3`);
  if (!fs.existsSync(audioPath)) throw new Error(`Missing audio file: ${audioPath}`);

  const lines = s.transliteration.split("\n").filter((l) => l.trim());
  const duration = probeDuration(audioPath);
  const silences = getSilenceIntervals(audioPath);
  const cues = computeCues(lines, duration, silences);

  // Count how many internal boundaries snapped to silence
  boundaryTotal += lines.length - 1;
  for (const m of silences) {
    if (cues.slice(1, -1).some((c) => Math.abs(c - round2(m.mid)) < 0.02)) snappedTotal++;
  }

  result[s.id] = cues;
}

fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + "\n");
console.log(`Wrote ${Object.keys(result).length} shloka line cues to ${path.relative(ROOT, OUT_PATH)} (${snappedTotal}/${boundaryTotal} internal boundaries snapped to detected silence).`);
