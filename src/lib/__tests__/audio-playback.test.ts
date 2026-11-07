import { describe, it, expect } from "vitest";
import { decideOnEnded, cycleLoop, cycleOption, formatTime, REPEAT_COUNTS } from "@/lib/audio-playback";

const base = { repeatCount: 3, currentRepeat: 0, isLast: false };

describe("decideOnEnded", () => {
  it("goes idle when looping is off", () => {
    expect(decideOnEnded({ ...base, loopMode: "off" })).toEqual({ type: "idle" });
  });
  it("repeat: replays until count reached then idles", () => {
    expect(decideOnEnded({ ...base, loopMode: "repeat", currentRepeat: 0 })).toEqual({ type: "replay", currentRepeat: 1 });
    expect(decideOnEnded({ ...base, loopMode: "repeat", currentRepeat: 1 })).toEqual({ type: "replay", currentRepeat: 2 });
    expect(decideOnEnded({ ...base, loopMode: "repeat", currentRepeat: 2 })).toEqual({ type: "idle" });
  });
  it("advance: moves on after count, idles on the last shloka", () => {
    expect(decideOnEnded({ ...base, loopMode: "advance", currentRepeat: 2 })).toEqual({ type: "advance" });
    expect(decideOnEnded({ ...base, loopMode: "advance", currentRepeat: 2, isLast: true })).toEqual({ type: "idle" });
  });
  it("infinite repeat always replays", () => {
    expect(decideOnEnded({ loopMode: "advance", repeatCount: Infinity, currentRepeat: 500, isLast: false }).type).toBe("replay");
  });
  it("count of 1 advances immediately", () => {
    expect(decideOnEnded({ loopMode: "advance", repeatCount: 1, currentRepeat: 0, isLast: false })).toEqual({ type: "advance" });
  });
});

describe("helpers", () => {
  it("cycles loop modes", () => {
    expect(cycleLoop("off")).toBe("repeat");
    expect(cycleLoop("repeat")).toBe("advance");
    expect(cycleLoop("advance")).toBe("off");
  });
  it("cycles options with wraparound", () => {
    expect(cycleOption(REPEAT_COUNTS, 1)).toBe(2);
    expect(cycleOption(REPEAT_COUNTS, Infinity)).toBe(1);
  });
  it("formats time", () => {
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(-3)).toBe("0:00");
  });
});
