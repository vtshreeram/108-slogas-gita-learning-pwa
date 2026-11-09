import { describe, it, expect } from "vitest";
import { buildChapters, neighbour, parsePositions, withPosition, resumeAt, formatLength, chapterAudioUrl } from "@/lib/chapter-audio";

const measured = [{ chapter: 2, key: "chapter-02.mp3", seconds: 100, bytes: 1 }, { chapter: 1, key: "chapter-01.mp3", seconds: 50, bytes: 1 }, { chapter: 99, key: "x.mp3", seconds: 1, bytes: 1 }];

describe("chapter list", () => {
  it("is sorted, named and drops unknown chapters", () => {
    const list = buildChapters(measured);
    expect(list.map((c) => c.chapter)).toEqual([1, 2]);
    expect(list[0].title).toMatch(/Arjuna/);
  });
  it("finds neighbours and stops at the ends", () => {
    const list = buildChapters(measured);
    expect(neighbour(list, 1, 1)?.chapter).toBe(2);
    expect(neighbour(list, 1, -1)).toBeUndefined();
    expect(neighbour(list, 2, 1)).toBeUndefined();
    expect(neighbour(list, 7, 1)).toBeUndefined();
  });
  it("builds track URLs from the configured base", () => {
    expect(chapterAudioUrl("chapter-01.mp3", "https://audio.example.com/")).toBe("https://audio.example.com/chapter-01.mp3");
  });
});

describe("resume positions", () => {
  it("ignores corrupt storage", () => {
    expect(parsePositions("nope")).toEqual({});
    expect(parsePositions("[1]")).toEqual({});
    expect(parsePositions('{"1":30,"2":"x","3":-4}')).toEqual({ "1": 30 });
  });
  it("saves mid-chapter positions", () => {
    expect(resumeAt(withPosition({}, 3, 90.7, 600), 3)).toBe(90);
  });
  it("forgets the start and the finished tail", () => {
    expect(withPosition({ "3": 90 }, 3, 2, 600)).toEqual({});
    expect(withPosition({ "3": 90 }, 3, 595, 600)).toEqual({});
  });
  it("keeps other chapters untouched", () => {
    expect(withPosition({ "1": 40 }, 2, 60, 600)).toEqual({ "1": 40, "2": 60 });
  });
});

describe("formatLength", () => {
  it("shows minutes, then hours", () => {
    expect(formatLength(38 * 60)).toBe("38 min");
    expect(formatLength(72 * 60)).toBe("1 h 12 min");
  });
});
