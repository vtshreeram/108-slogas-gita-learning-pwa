import { describe, it, expect } from "vitest";
import { SCHEMA_VERSION, STORAGE_KEY } from "@/lib/constants";
import { SHLOKAS } from "@/lib/shlokas";
import {
  initialState, parseState, parseBackupText, loadState, saveState, createMemoryStorage,
  markStep, markAsLearned, undoLearned, goTo, goNext, goPrev, goToShloka, deriveStats,
} from "@/lib/learning-progress";

const id0 = SHLOKAS[0].id;
const TODAY = "2026-04-10";

describe("persistence", () => {
  it("round-trips the initial state (empty lastPracticeDate must validate)", () => {
    const storage = createMemoryStorage();
    const state = { ...initialState(TODAY), activeIndex: 5, contentMode: "english" as const };
    saveState(storage, state);
    const loaded = loadState(storage, TODAY);
    expect(loaded.status).toBe("loaded");
    expect(loaded.state.activeIndex).toBe(5);
    expect(loaded.state.contentMode).toBe("english");
    expect(loaded.state.lastPracticeDate).toBe("");
  });

  it("keeps progress made only via markAsLearned across reload", () => {
    const storage = createMemoryStorage();
    saveState(storage, markAsLearned(initialState(TODAY), id0));
    const loaded = loadState(storage, TODAY);
    expect(loaded.status).toBe("loaded");
    expect(deriveStats(loaded.state).completedCount).toBe(1);
  });

  it("returns fresh state when nothing stored", () => {
    expect(loadState(createMemoryStorage(), TODAY).status).toBe("fresh");
  });

  it("stashes unreadable data instead of losing it", () => {
    const storage = createMemoryStorage("{not json");
    const loaded = loadState(storage, TODAY);
    expect(loaded.status).toBe("invalid");
    expect(storage.peekCorrupt()).toBe("{not json");
    const bad = JSON.stringify({ schemaVersion: 1 });
    const s2 = createMemoryStorage(bad);
    expect(loadState(s2, TODAY).status).toBe("invalid");
    expect(s2.peekCorrupt()).toBe(bad);
  });

  it("uses the expected storage key and schema version", () => {
    expect(STORAGE_KEY).toBe("gita-learning-state-v4");
    expect(SCHEMA_VERSION).toBe(4);
  });
});

describe("migration", () => {
  it("migrates legacy 'sanskrit' contentMode to 'tamil' before validation", () => {
    const legacy = { ...initialState(TODAY), contentMode: "sanskrit" };
    const r = parseState(legacy, TODAY);
    expect(r.ok && r.state.contentMode).toBe("tamil");
  });

  it("treats a missing lastPracticeDate as never practiced", () => {
    const { lastPracticeDate: _ignored, ...rest } = initialState(TODAY);
    void _ignored;
    const r = parseState(rest, TODAY);
    expect(r.ok && r.state.lastPracticeDate).toBe("");
  });

  it("rejects invalid backups with a readable error", () => {
    expect(parseBackupText("nope").ok).toBe(false);
    const r = parseBackupText(JSON.stringify({ ...initialState(TODAY), streakCount: -1 }));
    expect(r.ok).toBe(false);
  });

  it("clamps activeIndex from imported data", () => {
    const r = parseState({ ...initialState(TODAY), activeIndex: 107 }, TODAY);
    expect(r.ok && r.state.activeIndex).toBe(107);
  });
});

describe("transitions", () => {
  it("marking recall starts a streak and counts an attempt", () => {
    const s = markStep(initialState(TODAY), id0, "recall", TODAY);
    expect(s.streakCount).toBe(1);
    expect(s.recallAttempts).toBe(1);
    expect(s.lastPracticeDate).toBe(TODAY);
  });

  it("same-day recall does not bump the streak", () => {
    let s = markStep(initialState(TODAY), id0, "recall", TODAY);
    s = markStep(s, SHLOKAS[1].id, "recall", TODAY);
    expect(s.streakCount).toBe(1);
  });

  it("consecutive day continues, skipped day resets", () => {
    const s1 = markStep(initialState("2026-04-09"), id0, "recall", "2026-04-09");
    expect(markStep(s1, SHLOKAS[1].id, "recall", "2026-04-10").streakCount).toBe(2);
    expect(markStep(s1, SHLOKAS[1].id, "recall", "2026-04-12").streakCount).toBe(1);
  });

  it("non-recall steps leave streak and stats alone", () => {
    const s = markStep(initialState(TODAY), id0, "listen", TODAY);
    expect(s.streakCount).toBe(0);
    expect(s.recallAttempts).toBe(0);
    expect(s.completed[id0].listen).toBe(true);
  });

  it("markAsLearned completes all steps and advances; undo removes", () => {
    const s = markAsLearned(initialState(TODAY), id0);
    expect(s.activeIndex).toBe(1);
    expect(deriveStats(s).completedCount).toBe(1);
    expect(deriveStats(undoLearned(s, id0)).completedCount).toBe(0);
  });
});

describe("navigation", () => {
  it("clamps at both ends", () => {
    const s = initialState(TODAY);
    expect(goPrev(s).activeIndex).toBe(0);
    expect(goTo(s, 9999).activeIndex).toBe(SHLOKAS.length - 1);
    expect(goTo(s, -5).activeIndex).toBe(0);
    expect(goNext(goTo(s, SHLOKAS.length - 1)).activeIndex).toBe(SHLOKAS.length - 1);
    expect(goNext(s).activeIndex).toBe(1);
  });

  it("goToShloka finds by id and ignores unknown ids", () => {
    const s = initialState(TODAY);
    expect(goToShloka(s, SHLOKAS[7].id).activeIndex).toBe(7);
    expect(goToShloka(s, "nope")).toBe(s);
  });

  it("derives isFirst / isLast", () => {
    const s = initialState(TODAY);
    expect(deriveStats(s).isFirst).toBe(true);
    expect(deriveStats(goTo(s, 999)).isLast).toBe(true);
  });
});

describe("stats", () => {
  it("win rate is 0 with no attempts, then centralised", () => {
    expect(deriveStats(initialState(TODAY)).winRatePct).toBe(0);
    const s = { ...initialState(TODAY), recallAttempts: 4, recallWins: 3 };
    expect(deriveStats(s).winRatePct).toBe(75);
  });

  it("daily goal follows learning mode", () => {
    expect(deriveStats({ ...initialState(TODAY), activeMode: "lite" }).dailyGoal).toBe(1);
    expect(deriveStats(initialState(TODAY)).dailyGoal).toBeGreaterThan(1);
  });
});
