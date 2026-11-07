"use client";
import { useEffect, useState } from "react";
import { loadAllChapters, type GitaVerse } from "@/lib/gita-verses";

/** All 657 verses, loaded once in the background (cached offline by the service worker). */
export function useAllVerses(enabled: boolean): { verses: GitaVerse[] | null; failed: number[]; retry: () => void } {
  const [state, setState] = useState<{ verses: GitaVerse[] | null; failed: number[] }>({ verses: null, failed: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadAllChapters().then((r) => { if (!cancelled) setState(r); });
    return () => { cancelled = true; };
  }, [enabled, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
