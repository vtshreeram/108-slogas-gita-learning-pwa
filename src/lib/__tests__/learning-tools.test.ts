import { describe, expect, it } from "vitest";
import { fullDone } from "../constants";
import { initialState, markAsLearned, markStep, undoLearned, deriveStats, rateRecall, parseState, addDays } from "../learning-progress";
import { createBackup, readBackup, mergeProfiles } from "../backup";
import { mergeProgress } from "../progress-sync";
import { tamilChant } from "../tamil-chant";
import { currentLine, validLineCues, nextLineTurn } from "../line-practice";
import { SHLOKAS } from "../shlokas";
const day = "2026-11-07";
const id = SHLOKAS[0].id;

describe("daily completion counts", () => {
  it("counts distinct fully learned verses, not a boolean practice flag", () => {
    const one = markAsLearned(initialState(day), id, day);
    const two = markAsLearned(one, SHLOKAS[1].id, day);
    expect(deriveStats(one, day).learnedToday).toBe(1);
    expect(deriveStats(two, day).learnedToday).toBe(2);
    expect(deriveStats(markAsLearned(two, id, day), day).learnedToday).toBe(2);
    expect(deriveStats(two, "2026-11-08").learnedToday).toBe(0);
  });
  it("records completion through the four steps only when all are complete", () => {
    let s = initialState(day);
    for (const step of ["listen", "repeat", "understand"] as const) s = markStep(s, id, step, day);
    expect(deriveStats(s, day).learnedToday).toBe(0);
    s = markStep(s, id, "recall", day);
    expect(deriveStats(s, day).learnedToday).toBe(1);
    expect(s.reviews[id].dueDate).toBe("2026-11-08");
    expect(deriveStats(markStep(s, id, "recall", day), day).learnedToday).toBe(0);
  });
  it("undo removes completion and revision without changing other verses", () => {
    const one = markAsLearned(initialState(day), id, day);
    const undone = undoLearned(one, id);
    expect(undone.completionDates[id]).toBeUndefined();
    expect(undone.reviews[id]).toBeUndefined();
    expect(deriveStats(undone, day).learnedToday).toBe(0);
  });
  it("does not invent completion dates for legacy saves", () => {
    const { completionDates: _dates, reviews: _reviews, ...old } = markAsLearned(initialState(day), id, day);
    void _dates; void _reviews;
    const result = parseState(old, day);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fullDone(result.state.completed[id])).toBe(true);
    expect(deriveStats(result.state, day).learnedToday).toBe(0);
    expect(deriveStats(result.state, day).dueReviews.map((s) => s.id)).toContain(id);
  });
});

describe("revision schedule", () => {
  it("starts tomorrow, and ratings alter dates without inflating learning totals", () => {
    const base = markAsLearned(initialState(day), id, day);
    expect(deriveStats(base, day).dueReviews).toHaveLength(0);
    expect(deriveStats(base, "2026-11-08").dueReviews).toHaveLength(1);
    const forgot = rateRecall(base, id, "forgot", "2026-11-08");
    expect(forgot.reviews[id].dueDate).toBe("2026-11-08");
    expect(forgot.recallAttempts).toBe(1); expect(forgot.recallWins).toBe(0);
    const hard = rateRecall(forgot, id, "difficult", "2026-11-08");
    expect(hard.reviews[id].dueDate).toBe("2026-11-09");
    const easy = rateRecall(hard, id, "easy", "2026-11-08");
    expect(easy.reviews[id].dueDate).toBe("2026-11-11");
    expect(deriveStats(easy, "2026-11-08").learnedToday).toBe(0);
    expect(easy.streakCount).toBe(2);
  });
  it("ignores ratings for unlearned verses", () => {
    const base = initialState(day); expect(rateRecall(base, id, "easy", day)).toBe(base);
  });
  it("handles calendar boundaries and rejects impossible imported dates", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(parseState({ ...initialState(day), completionDates: { [id]: "2026-02-30" } }).ok).toBe(false);
  });
  it("merges completion histories and conservatively keeps a same-day forgotten review", () => {
    const a = markAsLearned(initialState(day), id, day);
    const b = rateRecall(a, id, "forgot", day);
    const easy = rateRecall(a, id, "easy", day);
    const merged = mergeProgress(easy, b);
    expect(merged.completionDates[id]).toBe(day);
    expect(merged.reviews[id].dueDate).toBe(day);
  });
});

describe("full backups", () => {
  it("round-trips favourites, profile, calibrated timings and scheduled reviews", () => {
    const progress = markAsLearned(initialState(day), id, day);
    const profile = { customName: "Learner", favorites: [id], lineCues: { [id]: [0, 2, 4] } };
    const backup = readBackup(JSON.stringify(createBackup(progress, profile)));
    expect(backup.profile).toEqual(profile);
    expect(backup.progress.reviews).toEqual(progress.reviews);
    expect(backup.progress.completionDates).toEqual(progress.completionDates);
  });
  it("accepts old progress-only files and keeps current profile when merging", () => {
    const backup = readBackup(JSON.stringify(initialState(day)));
    const profile = { customName: "Mine", favorites: [id], lineCues: {} };
    expect(backup.profile).toBeUndefined(); expect(mergeProfiles(profile, backup.profile)).toEqual(profile);
  });
  it("unions favourites while preserving current line timings and name", () => {
    expect(mergeProfiles({ customName: "Mine", favorites: [id], lineCues: { [id]: [0, 2] } }, { customName: "Other", favorites: [SHLOKAS[1].id, id], lineCues: { [id]: [0, 3] } })).toEqual({ customName: "Mine", favorites: [id, SHLOKAS[1].id], lineCues: { [id]: [0, 2] } });
  });
  it("rejects malformed, oversized, unsupported and non-monotonic timing files", () => {
    expect(() => readBackup("{bad")).toThrow();
    expect(() => readBackup(" ".repeat(2_000_001))).toThrow(/large/);
    expect(() => readBackup(JSON.stringify({ kind: "gita108", version: 99 }))).toThrow(/invalid/);
    expect(() => readBackup(JSON.stringify(createBackup(initialState(day), { customName: null, favorites: [], lineCues: { [id]: [0, 3, 2] } })))).toThrow(/invalid/);
  });
});

describe("chanting tools", () => {
  it("renders every dataset entry without unconverted Latin characters", () => {
    for (const s of SHLOKAS) expect(tamilChant(s.transliteration), s.reference).not.toMatch(/[a-zāīūṛṝḷḹṅñṭḍṇśṣṁṃḥ]/i);
  });
  it("preserves voiced and aspirated consonant distinctions", () => {
    expect(tamilChant("ka kha ga gha")).toBe("க க² க³ க⁴");
    expect(tamilChant("śrī kṛṣṇaḥ")).toBe("ஶ்ரீ க்ருஷ்ணஃ");
  });
  it("uses measured, increasing boundaries matching the number of lines", () => {
    expect(validLineCues([0, 2, 5], 2, 5)).toBe(true);
    for (const cues of [[0, 3, 2], [0, 2], [0, 2, 6], [0, NaN, 5]]) expect(validLineCues(cues, 2, 5)).toBe(false);
    expect(currentLine([0, 2, 5], 2)).toBe(1);
    expect(currentLine([0, 2, 5], 5)).toBe(-1);
    expect(nextLineTurn(0, 0, 2, 2, true)).toEqual({ line: 0, repetition: 1 });
    expect(nextLineTurn(0, 1, 2, 2, true)).toEqual({ line: 1, repetition: 0 });
    expect(nextLineTurn(1, 1, 2, 2, true)).toBeNull();
    expect(nextLineTurn(0, 1, 2, 2, false)).toBeNull();
  });
});

describe("visible sync status", () => {
  it("reports success and failure without claiming that a rejected cloud write synced", async () => {
    const { createProgressSync } = await import("../progress-sync");
    const statuses: string[] = [];
    const snapshot = { state: initialState(day), meta: { updatedAt: 1, linked: true } };
    const success = createProgressSync({ uid: "test", remote: { pull: async () => null, push: async () => {} }, getLocal: () => snapshot, apply: () => {}, setMeta: () => {}, onStatus: (s) => statuses.push(s) });
    await success.syncNow(); expect(statuses).toEqual(["syncing", "synced"]); success.dispose();
    statuses.length = 0;
    const failure = createProgressSync({ uid: "test", remote: { pull: async () => null, push: async () => { throw new Error("offline"); } }, getLocal: () => snapshot, apply: () => {}, setMeta: () => {}, onStatus: (s) => statuses.push(s) });
    await failure.syncNow(); expect(statuses).toEqual(["syncing", "error"]); failure.dispose();
  });
});
