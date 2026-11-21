import lineCues from "@/data/line-cues.json";

export function validLineCues(cues: number[] | undefined, lineCount: number, duration: number): cues is number[] {
  return Boolean(cues && cues.length === lineCount + 1 && Number.isFinite(duration) && duration > 0 && cues.every((cue, i) => Number.isFinite(cue) && cue >= 0 && cue <= duration + 0.05 && (i === 0 || cue - cues[i - 1] >= 0.1)));
}
export function currentLine(cues: number[], time: number): number {
  return cues.findIndex((start, i) => i < cues.length - 1 && time >= start && time < cues[i + 1]);
}
export function nextLineTurn(line: number, repetition: number, repeats: number, count: number, advance: boolean) {
  if (repetition + 1 < repeats) return { line, repetition: repetition + 1 };
  return advance && line + 1 < count ? { line: line + 1, repetition: 0 } : null;
}
export { AUDIO_TRANSPORT_EVENT } from "@/lib/audio-transport";
export { recallHintLines } from "@/lib/recall-hints";

/** Built-in line cue timestamps for the 108 recordings, keyed by shloka id (see scripts/build-line-cues.mjs). */
export const DEFAULT_LINE_CUES: Record<string, number[]> = lineCues;

/** The learner's own marked timings win; otherwise fall back to the built-in cues (if any). */
export function resolveLineCues(userCues: number[] | undefined, shlokaId: string): number[] | undefined {
  return userCues ?? DEFAULT_LINE_CUES[shlokaId];
}
