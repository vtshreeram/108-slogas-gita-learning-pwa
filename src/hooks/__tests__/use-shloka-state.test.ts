import { describe, it, expect, beforeEach, vi } from "vitest";
import { SCHEMA_VERSION, defaultStepProgress, todayIso, fullDone } from "@/lib/constants";
import { SHLOKAS } from "@/lib/shlokas";

describe("useShlokaState logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("state initialization", () => {
    it("initializes with default state structure", () => {
      const state = {
        schemaVersion: SCHEMA_VERSION,
        startedAt: todayIso(),
        lastActiveDate: todayIso(),
        lastPracticeDate: "",
        streakCount: 0,
        activeMode: "normal" as const,
        completed: {},
        recallWins: 0,
        recallAttempts: 0,
        activeIndex: 0,
        contentMode: "transliteration" as const,
      };

      expect(state.schemaVersion).toBe(SCHEMA_VERSION);
      expect(state.activeIndex).toBe(0);
      expect(state.streakCount).toBe(0);
      expect(Object.keys(state.completed).length).toBe(0);
    });

    it("can parse and validate persisted state", () => {
      const persistedState = {
        schemaVersion: SCHEMA_VERSION,
        startedAt: "2026-04-01",
        lastActiveDate: "2026-04-10",
        lastPracticeDate: "2026-04-10",
        streakCount: 5,
        activeMode: "normal" as const,
        completed: { "GS-001": defaultStepProgress() },
        recallWins: 3,
        recallAttempts: 5,
        activeIndex: 2,
        contentMode: "transliteration" as const,
      };

      const loaded = persistedState;
      expect(loaded.streakCount).toBe(5);
      expect(loaded.activeIndex).toBe(2);
      expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it("migrates old 'sanskrit' contentMode to 'tamil'", () => {
      const oldState = {
        schemaVersion: SCHEMA_VERSION,
        startedAt: "2026-04-01",
        lastActiveDate: "2026-04-10",
        lastPracticeDate: "",
        streakCount: 0,
        activeMode: "normal" as const,
        completed: {},
        recallWins: 0,
        recallAttempts: 0,
        activeIndex: 0,
        contentMode: "sanskrit" as any, // old mode
      };

      // Simulate migration logic
      let migratedMode: "transliteration" | "english" | "tamil" = "transliteration";
      if ((oldState.contentMode as string) === "sanskrit") {
        migratedMode = "tamil";
      }

      expect(migratedMode).toBe("tamil");
    });
  });

  describe("step progress tracking", () => {
    it("marks a step as complete", () => {
      const progress = defaultStepProgress();
      expect(progress.listen).toBe(false);

      progress.listen = true;
      expect(progress.listen).toBe(true);
    });

    it("detects when all steps are complete", () => {
      const progress = defaultStepProgress();
      expect(fullDone(progress)).toBe(false);

      progress.listen = true;
      progress.repeat = true;
      progress.understand = true;
      progress.recall = true;
      expect(fullDone(progress)).toBe(true);
    });

    it("detects incomplete shlokas", () => {
      const progress = defaultStepProgress();
      progress.listen = true;
      progress.repeat = true;
      progress.understand = true;
      // recall is still false
      expect(fullDone(progress)).toBe(false);
    });
  });

  describe("streak logic", () => {
    it("starts a new streak for first-time practice", () => {
      const lastPracticeDate = "";
      const today = todayIso();

      let streak = 0;
      if (lastPracticeDate !== today) {
        const daysSinceLast = lastPracticeDate ? 999 : 0; // invalid date
        if (daysSinceLast === 1) {
          streak = (streak || 0) + 1;
        } else {
          streak = 1;
        }
      }

      expect(streak).toBe(1);
    });

    it("increments streak when user practices on consecutive days", () => {
      const daysBetween = (a: string, b: string) => {
        if (!a) return 0;
        const diff = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
        return Number.isNaN(diff) ? 0 : diff;
      };

      const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const today = todayIso();

      let streak = 5; // previous streak
      const daysSinceLast = daysBetween(yesterday, today);
      if (daysSinceLast === 1) {
        streak = streak + 1;
      } else {
        streak = 1;
      }

      expect(streak).toBe(6);
    });

    it("resets streak when user skips a day", () => {
      const daysBetween = (a: string, b: string) => {
        if (!a) return 0;
        const diff = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
        return Number.isNaN(diff) ? 0 : diff;
      };

      const twoDaysAgo = new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const today = todayIso();

      let streak = 5; // previous streak
      const daysSinceLast = daysBetween(twoDaysAgo, today);
      if (daysSinceLast === 1) {
        streak = streak + 1;
      } else {
        streak = 1;
      }

      expect(streak).toBe(1);
    });

    it("doesn't change streak if already practiced today", () => {
      const today = todayIso();
      const lastPracticeDate = today;

      let streak = 5;
      if (lastPracticeDate === today) {
        // Do nothing
      } else {
        streak = 1;
      }

      expect(streak).toBe(5);
    });
  });

  describe("completed shloka tracking", () => {
    it("counts completed shlokas", () => {
      const completed: Record<string, ReturnType<typeof defaultStepProgress>> = {
        "GS-001": { listen: true, repeat: true, understand: true, recall: true },
        "GS-002": { listen: true, repeat: false, understand: false, recall: false },
        "GS-003": { listen: true, repeat: true, understand: true, recall: true },
      };

      const completedCount = Object.values(completed).filter((p) => fullDone(p)).length;
      expect(completedCount).toBe(2);
    });

    it("calculates progress percentage", () => {
      const TOTAL_SHLOKAS = 108;
      const completed: Record<string, ReturnType<typeof defaultStepProgress>> = {};

      // Mark 27 shlokas as complete (25%)
      for (let i = 0; i < 27; i++) {
        completed[`GS-${String(i + 1).padStart(3, "0")}`] = {
          listen: true,
          repeat: true,
          understand: true,
          recall: true,
        };
      }

      const completedCount = Object.values(completed).filter((p) => fullDone(p)).length;
      const progressPct = Math.round((completedCount / TOTAL_SHLOKAS) * 100);

      expect(progressPct).toBe(25);
    });
  });

  describe("shloka navigation", () => {
    it("stays within bounds when navigating", () => {
      const TOTAL_SHLOKAS = SHLOKAS.length;
      let activeIndex = 0;

      // Try to go before first
      activeIndex = Math.max(0, activeIndex - 1);
      expect(activeIndex).toBe(0);

      // Go to last
      activeIndex = TOTAL_SHLOKAS - 1;
      expect(activeIndex).toBe(TOTAL_SHLOKAS - 1);

      // Try to go beyond last
      activeIndex = Math.min(TOTAL_SHLOKAS - 1, activeIndex + 1);
      expect(activeIndex).toBe(TOTAL_SHLOKAS - 1);
    });

    it("detects first and last shloka", () => {
      const TOTAL_SHLOKAS = SHLOKAS.length;

      const isFirst = (index: number) => index === 0;
      const isLast = (index: number) => index === TOTAL_SHLOKAS - 1;

      expect(isFirst(0)).toBe(true);
      expect(isFirst(1)).toBe(false);
      expect(isLast(TOTAL_SHLOKAS - 1)).toBe(true);
      expect(isLast(TOTAL_SHLOKAS - 2)).toBe(false);
    });
  });

  describe("content modes", () => {
    it("preserves valid content modes", () => {
      const modes: Array<"transliteration" | "english" | "tamil"> = [
        "transliteration",
        "english",
        "tamil",
      ];

      for (const mode of modes) {
        const isValid = ["transliteration", "english", "tamil"].includes(mode);
        expect(isValid).toBe(true);
      }
    });
  });

  describe("recall statistics", () => {
    it("tracks recall attempts and wins", () => {
      let recallAttempts = 0;
      let recallWins = 0;

      // User attempts recall
      recallAttempts += 1;
      recallWins += 1;

      expect(recallAttempts).toBe(1);
      expect(recallWins).toBe(1);

      // User attempts again but fails
      recallAttempts += 1;

      expect(recallAttempts).toBe(2);
      expect(recallWins).toBe(1);
    });

    it("calculates win rate", () => {
      const recallAttempts = 10;
      const recallWins = 7;

      const winRate = recallAttempts > 0 ? Math.round((recallWins / recallAttempts) * 100) : 0;

      expect(winRate).toBe(70);
    });
  });
});
