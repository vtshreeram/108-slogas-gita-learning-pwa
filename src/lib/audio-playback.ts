/** Pure playback policy for the audio player (no DOM, no React). */

export type LoopMode = "off" | "repeat" | "advance";
export const REPEAT_COUNTS = [1, 2, 3, 5, 10, Infinity] as const;
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export type EndedAction =
  | { type: "idle" }
  | { type: "replay"; currentRepeat: number }
  | { type: "advance" };

/**
 * What to do when a clip ends.
 * - off: go idle
 * - repeat: replay until repeatCount reached, then idle
 * - advance: replay until repeatCount reached, then move to the next shloka (idle on the last one)
 */
export function decideOnEnded(input: {
  loopMode: LoopMode;
  repeatCount: number;
  currentRepeat: number;
  isLast: boolean;
}): EndedAction {
  const { loopMode, repeatCount, currentRepeat, isLast } = input;
  if (loopMode === "off") return { type: "idle" };
  const nextRepeat = currentRepeat + 1;
  if (repeatCount === Infinity || nextRepeat < repeatCount) return { type: "replay", currentRepeat: nextRepeat };
  if (loopMode === "advance" && !isLast) return { type: "advance" };
  return { type: "idle" };
}

export function cycleLoop(mode: LoopMode): LoopMode {
  return mode === "off" ? "repeat" : mode === "repeat" ? "advance" : "off";
}

export function cycleOption<T extends number>(options: readonly T[], current: number): T {
  const idx = options.indexOf(current as T);
  return options[(idx + 1) % options.length];
}

export function formatTime(secs: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(secs) ? secs : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
