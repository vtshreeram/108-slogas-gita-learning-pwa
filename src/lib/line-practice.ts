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
export const AUDIO_TRANSPORT_EVENT = "gita-audio-transport";
