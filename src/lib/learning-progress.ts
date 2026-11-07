/**
 * Learning progress module.
 *
 * Owns the persisted AppState: initial state, parsing/migration of stored or
 * imported data, every state transition (steps, learned, navigation, modes),
 * streak/recall rules and derived stats. Pure and storage-agnostic; the only
 * seam is `ProgressStorage` (localStorage in the app, in-memory in tests).
 */
import { SHLOKAS, TOTAL_SHLOKAS, DAILY_TARGET, LoopStep } from "@/lib/shlokas";
import {
  AppState,
  STORAGE_KEY,
  SCHEMA_VERSION,
  defaultStepProgress,
  todayIso,
  fullDone,
  daysBetween,
} from "@/lib/constants";
import { appStateBackupSchema } from "@/lib/schemas";

// ---------------------------------------------------------------- storage seam

export type ProgressStorage = {
  read(): string | null;
  write(value: string): void;
};

export const CORRUPT_STORAGE_KEY = `${STORAGE_KEY}-corrupt`;

export const localStorageAdapter: ProgressStorage = {
  read: () => localStorage.getItem(STORAGE_KEY),
  write: (value) => localStorage.setItem(STORAGE_KEY, value),
};

export function createMemoryStorage(initial: string | null = null) {
  let value = initial;
  let corrupt: string | null = null;
  return {
    read: () => value,
    write: (next: string) => { value = next; },
    stashCorrupt: (raw: string) => { corrupt = raw; },
    peekCorrupt: () => corrupt,
  };
}

// ---------------------------------------------------------------- construction

export const initialState = (today: string = todayIso()): AppState => ({
  schemaVersion: SCHEMA_VERSION,
  startedAt: today,
  lastActiveDate: today,
  lastPracticeDate: "",
  streakCount: 0,
  activeMode: "normal",
  completed: {},
  recallWins: 0,
  recallAttempts: 0,
  activeIndex: 0,
  contentMode: "transliteration",
});

export const CHAPTER_LIST = [...new Set(SHLOKAS.map((s) => s.chapter))].sort((a, b) => a - b);

const clampIndex = (i: number) => Math.max(0, Math.min(SHLOKAS.length - 1, Math.trunc(i) || 0));

// ---------------------------------------------------------------- parse / migrate

export type ParseResult =
  | { ok: true; state: AppState }
  | { ok: false; error: string };

/** Legacy shapes are upgraded *before* validation so old data is never rejected. */
function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const data = { ...(raw as Record<string, unknown>) };
  // "sanskrit" display mode was replaced by "tamil".
  if (data.contentMode === "sanskrit") data.contentMode = "tamil";
  // Older saves may lack a practice date; "" means "never practiced".
  if (data.lastPracticeDate === undefined || data.lastPracticeDate === null) data.lastPracticeDate = "";
  return data;
}

export function parseState(raw: unknown, today: string = todayIso()): ParseResult {
  const validated = appStateBackupSchema.safeParse(migrate(raw));
  if (!validated.success) {
    const error = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { ok: false, error };
  }
  const d = validated.data;
  return {
    ok: true,
    state: {
      schemaVersion: SCHEMA_VERSION,
      startedAt: d.startedAt,
      lastActiveDate: today,
      lastPracticeDate: d.lastPracticeDate,
      streakCount: d.streakCount,
      activeMode: d.activeMode,
      completed: d.completed,
      recallWins: d.recallWins,
      recallAttempts: d.recallAttempts,
      activeIndex: clampIndex(d.activeIndex),
      contentMode: d.contentMode,
    },
  };
}

/** Parse the text of an imported backup file. */
export function parseBackupText(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON" };
  }
  return parseState(json);
}

// ---------------------------------------------------------------- load / save

export type LoadResult = {
  state: AppState;
  status: "fresh" | "loaded" | "invalid";
  error?: string;
};

type Stashable = ProgressStorage & { stashCorrupt?: (raw: string) => void };

/**
 * Load persisted state. Unreadable data is stashed under a side key before
 * defaults are returned, so the follow-up save can never destroy it.
 */
export function loadState(storage: Stashable, today: string = todayIso()): LoadResult {
  let raw: string | null;
  try {
    raw = storage.read();
  } catch (e) {
    return { state: initialState(today), status: "invalid", error: String(e) };
  }
  if (!raw) return { state: initialState(today), status: "fresh" };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    stash(storage, raw);
    return { state: initialState(today), status: "invalid", error: String(e) };
  }
  const parsed = parseState(json, today);
  if (!parsed.ok) {
    stash(storage, raw);
    return { state: initialState(today), status: "invalid", error: parsed.error };
  }
  return { state: parsed.state, status: "loaded" };
}

function stash(storage: Stashable, raw: string) {
  try {
    if (storage.stashCorrupt) storage.stashCorrupt(raw);
    else if (typeof localStorage !== "undefined") localStorage.setItem(CORRUPT_STORAGE_KEY, raw);
  } catch { /* best effort */ }
}

export function saveState(storage: ProgressStorage, state: AppState) {
  storage.write(JSON.stringify(state));
}

// ---------------------------------------------------------------- transitions

export function markStep(prev: AppState, id: string, step: LoopStep, today: string = todayIso()): AppState {
  const current = prev.completed[id] ?? defaultStepProgress();
  const isMarkingTrue = !current[step];
  const updated = { ...current, [step]: isMarkingTrue };
  let { lastPracticeDate, streakCount } = prev;
  const isRecall = step === "recall" && isMarkingTrue;
  if (isRecall) {
    if (lastPracticeDate !== today) {
      streakCount = daysBetween(lastPracticeDate, today) === 1 ? (prev.streakCount || 0) + 1 : 1;
    }
    lastPracticeDate = today;
  }
  return {
    ...prev,
    completed: { ...prev.completed, [id]: updated },
    recallAttempts: isRecall ? prev.recallAttempts + 1 : prev.recallAttempts,
    recallWins: isRecall ? prev.recallWins + 1 : prev.recallWins,
    lastPracticeDate,
    streakCount,
  };
}

export function markAsLearned(prev: AppState, id: string): AppState {
  return {
    ...prev,
    completed: { ...prev.completed, [id]: { listen: true, repeat: true, understand: true, recall: true } },
    activeIndex: clampIndex(prev.activeIndex + 1),
  };
}

export function undoLearned(prev: AppState, id: string): AppState {
  const completed = { ...prev.completed };
  delete completed[id];
  return { ...prev, completed };
}

export const goTo = (prev: AppState, index: number): AppState => ({ ...prev, activeIndex: clampIndex(index) });
export const goNext = (state: AppState): AppState => goTo(state, state.activeIndex + 1);
export const goPrev = (state: AppState): AppState => goTo(state, state.activeIndex - 1);
export const goToShloka = (state: AppState, shlokaId: string): AppState => {
  const index = SHLOKAS.findIndex((s) => s.id === shlokaId);
  return index < 0 ? state : goTo(state, index);
};
export const setContentMode = (state: AppState, contentMode: AppState["contentMode"]): AppState => ({ ...state, contentMode });
export const setActiveMode = (state: AppState, activeMode: AppState["activeMode"]): AppState => ({ ...state, activeMode });

// ---------------------------------------------------------------- derived

export function deriveStats(state: AppState) {
  const completedShlokas = SHLOKAS.filter((s) => fullDone(state.completed[s.id]));
  const completedCount = completedShlokas.length;
  const activeIndex = clampIndex(state.activeIndex);
  const active = SHLOKAS[activeIndex];
  const activeProgress = state.completed[active.id] ?? defaultStepProgress();
  const dailyGoal = state.activeMode === "lite" ? 1 : DAILY_TARGET;
  return {
    completedShlokas,
    completedCount,
    progressPct: Math.round((completedCount / TOTAL_SHLOKAS) * 100),
    // NOTE: wins always equal attempts today (no "missed recall" input exists).
    winRatePct: state.recallAttempts > 0 ? Math.round((state.recallWins / state.recallAttempts) * 100) : 0,
    streak: state.streakCount,
    active,
    safeActiveIndex: activeIndex,
    activeGlobalIndex: activeIndex + 1,
    activeProgress,
    isFirst: activeIndex === 0,
    isLast: activeIndex === TOTAL_SHLOKAS - 1,
    isMastered: fullDone(activeProgress),
    dailyGoal,
  };
}
