import { z } from "zod";
import { SCHEMA_VERSION } from "@/lib/constants";

/**
 * Zod schema for validating a single step's progress within the 4-step learning loop.
 */
export const stepProgressSchema = z.object({
  listen: z.boolean(),
  repeat: z.boolean(),
  understand: z.boolean(),
  recall: z.boolean(),
});

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").refine((s) => {
  const date = new Date(`${s}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
}, "Invalid calendar date");
const verseId = z.string().regex(/^GS-(?:00[1-9]|0[1-9]\d|10[0-8])$/);
export const reviewSchema = z.object({
  dueDate: dateSchema,
  lastReviewed: dateSchema,
  intervalDays: z.number().int().min(0).max(365),
  lastRating: z.enum(["forgot", "difficult", "easy"]),
});

/**
 * Zod schema for validating the entire AppState backup file structure.
 * Ensures type safety and data integrity when importing or reading from localStorage.
 */
export const appStateBackupSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  lastActiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  // "" means "never practiced" (the initial state).
  lastPracticeDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")]),
  streakCount: z.number().int().min(0).max(36500),
  activeMode: z.enum(["normal", "lite"]),
  completed: z.record(z.string(), stepProgressSchema),
  completionDates: z.record(verseId, dateSchema).default({}),
  reviews: z.record(verseId, reviewSchema).default({}),
  recallWins: z.number().int().min(0),
  recallAttempts: z.number().int().min(0),
  activeIndex: z.number().int().min(0).max(107),
  contentMode: z.enum(["transliteration", "english", "tamil"]),
});

/**
 * Zod schema for user profile data stored in localStorage.
 */
export const profileSchema = z.object({
  customName: z.string().max(80).nullable(),
  favorites: z.array(z.string().max(20)).max(108),
  lineCues: z.record(verseId, z.array(z.number().finite().min(0).max(7200)).min(2).max(24).refine((values) => values.every((v, i) => i === 0 || v > values[i - 1]), "Line times must increase")).default({}),
});
