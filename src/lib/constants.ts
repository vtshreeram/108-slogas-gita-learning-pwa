import type { ComponentType } from "react";
import { Headphones, RotateCcw, BookOpen, Brain } from "lucide-react";

export type LoopStep = "listen" | "repeat" | "understand" | "recall";
export type StepProgress = Record<LoopStep, boolean>;
export type ItemProgress = Record<string, StepProgress>;
export type RecallRating = "forgot" | "difficult" | "easy";
export type ReviewSchedule = { dueDate: string; lastReviewed: string; intervalDays: number; lastRating: RecallRating };

export type AppState = {
  schemaVersion: number;
  startedAt: string;
  lastActiveDate: string;
  lastPracticeDate: string;
  streakCount: number;
  activeMode: "normal" | "lite";
  completed: ItemProgress;
  completionDates: Record<string, string>;
  reviews: Record<string, ReviewSchedule>;
  recallWins: number;
  recallAttempts: number;
  activeIndex: number;
  contentMode: "transliteration" | "english" | "tamil"; // Content display mode (Roman/Meaning/Tamil)
};

export const STORAGE_KEY = "gita-learning-state-v4";
export const SCHEMA_VERSION = 4;
export const LOOP_STEPS: LoopStep[] = ["listen", "repeat", "understand", "recall"];

export const STEP_CONFIG: Record<LoopStep, { Icon: ComponentType<{ className?: string }>; label: string }> = {
  listen:     { Icon: Headphones, label: "Listen" },
  repeat:     { Icon: RotateCcw,  label: "Repeat" },
  understand: { Icon: BookOpen,   label: "Understand"  },
  recall:     { Icon: Brain,      label: "Recall" },
};

// Touch gesture configuration
export const SWIPE_THRESHOLD_PX = 50; // Minimum distance in pixels to register a swipe

// Content display modes for shlokas
// - "transliteration": Roman transliteration of Sanskrit
// - "english": English translation by Prabhupada
// - "tamil": Tamil meaning, edited from Bharathiyar's translation
export const CONTENT_TABS: { mode: AppState["contentMode"]; label: string }[] = [
  { mode: "transliteration", label: "Sloka" },
  { mode: "english",         label: "English" },
  { mode: "tamil",            label: "Tamil" },
];

export const defaultStepProgress = (): StepProgress => ({
  listen: false,
  repeat: false,
  understand: false,
  recall: false,
});

/** Local calendar date (YYYY-MM-DD), so streaks follow the user's own midnight, not UTC. */
export const localDateIso = (d: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const todayIso = () => localDateIso();
export const fullDone = (step?: StepProgress) => Boolean(step?.listen && step.repeat && step.understand && step.recall);
export const daysBetween = (a: string, b: string) => {
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / oneDay);
  return Number.isNaN(diff) ? 0 : diff;
};
