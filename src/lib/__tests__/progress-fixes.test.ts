import { describe, it, expect } from "vitest";
import { SHLOKAS } from "@/lib/shlokas";
import { initialState, markStep, markAsLearned } from "@/lib/learning-progress";
import { createMemoryKV, progressStoreFor } from "@/lib/progress-store";
import { cleanFavorites } from "@/lib/schemas";
import { mergeProfiles } from "@/lib/backup";

const id0 = SHLOKAS[0].id;
const TODAY = "2026-04-10";
const LATER = "2026-04-24";

function fullLoop(today: string) {
  let s = initialState(today);
  for (const step of ["listen", "repeat", "understand", "recall"] as const) s = markStep(s, id0, step, today);
  return s;
}

describe("unchecking a step", () => {
  it("undoes a completion earned today", () => {
    const s = markStep(fullLoop(TODAY), id0, "repeat", TODAY);
    expect(s.completionDates[id0]).toBeUndefined();
    expect(s.reviews[id0]).toBeUndefined();
  });

  it("keeps the schedule of a verse learned on an earlier day", () => {
    const learned = fullLoop(TODAY);
    const s = markStep(learned, id0, "repeat", LATER);
    expect(s.completionDates[id0]).toBe(TODAY);
    expect(s.reviews[id0]).toEqual(learned.reviews[id0]);
  });

  it("re-checking after an old uncheck does not restamp the learned date", () => {
    const s = markStep(markStep(fullLoop(TODAY), id0, "repeat", LATER), id0, "repeat", LATER);
    expect(s.completionDates[id0]).toBe(TODAY);
  });
});

describe("recall counters", () => {
  it("toggling Recall off and on does not inflate attempts or wins", () => {
    let s = fullLoop(TODAY);
    expect([s.recallAttempts, s.recallWins]).toEqual([1, 1]);
    for (let i = 0; i < 3; i++) { s = markStep(s, id0, "recall", TODAY); s = markStep(s, id0, "recall", TODAY); }
    expect([s.recallAttempts, s.recallWins]).toEqual([1, 1]);
  });

  it("re-checking Recall on a verse learned on an earlier day does not count again", () => {
    let s = fullLoop(TODAY);
    for (let i = 0; i < 3; i++) { s = markStep(s, id0, "recall", LATER); s = markStep(s, id0, "recall", LATER); }
    expect([s.recallAttempts, s.recallWins]).toEqual([1, 1]);
  });

  it("reverses Recall checked on a not-yet-completed verse", () => {
    let s = markStep(initialState(TODAY), id0, "recall", TODAY);
    expect([s.recallAttempts, s.recallWins]).toEqual([1, 1]);
    s = markStep(s, id0, "recall", TODAY);
    expect([s.recallAttempts, s.recallWins]).toEqual([0, 0]);
    s = markStep(s, id0, "recall", TODAY);
    expect([s.recallAttempts, s.recallWins]).toEqual([1, 1]);
  });

  it("never goes below zero", () => {
    const s = markStep({ ...initialState(TODAY), completed: { [id0]: { listen: false, repeat: false, understand: false, recall: true } } }, id0, "recall", TODAY);
    expect([s.recallAttempts, s.recallWins]).toEqual([0, 0]);
  });
});

describe("streak when the clock moves backwards", () => {
  it("keeps the streak instead of resetting it", () => {
    const s = { ...initialState(TODAY), lastPracticeDate: "2026-04-12", streakCount: 5 };
    expect(markAsLearned(s, id0, "2026-04-10").streakCount).toBe(5);
    expect(markStep({ ...s, completed: { [id0]: { listen: true, repeat: true, understand: true, recall: false } } }, id0, "recall", "2026-04-10").streakCount).toBe(5);
  });
});

describe("unreadable-data stash", () => {
  it("never overwrites the first stashed copy", () => {
    const kv = createMemoryKV();
    const store = progressStoreFor(kv, "u1");
    store.stashCorrupt("first");
    store.stashCorrupt("second");
    const dump = kv.dump();
    expect(Object.values(dump).sort()).toEqual(["first", "second"]);
    expect(dump["gita-learning-state-v4-corrupt:u1"]).toBe("first");
  });
});

describe("favorites", () => {
  it("drops junk and duplicates and caps at 108", () => {
    const ids = SHLOKAS.map((s) => s.id);
    expect(cleanFavorites(["bad", ids[0], ids[0], "GS-999"])).toEqual([ids[0]]);
    expect(cleanFavorites([...ids, ...ids])).toHaveLength(108);
  });

  it("merging a backup with junk keeps the profile valid", () => {
    const local = { customName: null, favorites: [SHLOKAS[0].id], lineCues: {} };
    const incoming = { customName: null, favorites: ["junk", SHLOKAS[1].id], lineCues: {} };
    expect(mergeProfiles(local, incoming).favorites).toEqual([SHLOKAS[0].id, SHLOKAS[1].id]);
  });
});
