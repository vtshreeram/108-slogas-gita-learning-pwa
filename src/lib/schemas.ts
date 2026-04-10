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

/**
 * Zod schema for validating the entire AppState backup file structure.
 * Ensures type safety and data integrity when importing or reading from localStorage.
 */
export const appStateBackupSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  lastActiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  lastPracticeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  streakCount: z.number().int().min(0).max(36500),
  activeMode: z.enum(["normal", "lite"]),
  completed: z.record(z.string(), stepProgressSchema),
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
});
