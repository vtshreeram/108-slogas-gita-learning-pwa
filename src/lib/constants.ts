import type { ComponentType } from "react";
import { Headphones, RotateCcw, BookOpen, Brain } from "lucide-react";

export type LoopStep = "listen" | "repeat" | "understand" | "recall";
export type StepProgress = Record<LoopStep, boolean>;
export type ItemProgress = Record<string, StepProgress>;

export type AppState = {
  schemaVersion: number;
  startedAt: string;
  lastActiveDate: string;
  lastPracticeDate: string;
  streakCount: number;
  activeMode: "normal" | "lite";
  completed: ItemProgress;
  recallWins: number;
  recallAttempts: number;
  activeIndex: number;
  contentMode: "transliteration" | "english" | "sanskrit";
};

export const STORAGE_KEY = "gita-learning-state-v4";
export const SCHEMA_VERSION = 4;
export const LOOP_STEPS: LoopStep[] = ["listen", "repeat", "understand", "recall"];

export const STEP_CONFIG: Record<LoopStep, { Icon: ComponentType<{ className?: string }>; label: string }> = {
  listen:     { Icon: Headphones, label: "Listen" },
  repeat:     { Icon: RotateCcw,  label: "Repeat" },
  understand: { Icon: BookOpen,   label: "Grasp"  },
  recall:     { Icon: Brain,      label: "Recall" },
};

export const CONTENT_TABS: { mode: AppState["contentMode"]; label: string }[] = [
  { mode: "transliteration", label: "Roman" },
  { mode: "english",         label: "Meaning" },
  { mode: "sanskrit",        label: "Sanskrit" },
];

export const defaultStepProgress = (): StepProgress => ({
  listen: false,
  repeat: false,
  understand: false,
  recall: false,
});

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const fullDone = (step?: StepProgress) => Boolean(step?.listen && step.repeat && step.understand && step.recall);
export const daysBetween = (a: string, b: string) => {
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / oneDay);
  return Number.isNaN(diff) ? 0 : diff;
};
