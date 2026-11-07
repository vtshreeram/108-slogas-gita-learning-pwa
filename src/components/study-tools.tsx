"use client";
import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** One collapsed row under the shloka card. Holds every extra tool so the core screen stays untouched. */
export function StudyTools({ dueCount, children }: { dueCount: number; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-[#f0d498] bg-[#fffaf0] dark:border-[#423321] dark:bg-[#1e1710]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#705735] dark:text-[#bda27e] [&::-webkit-details-marker]:hidden">
        <span>Study tools{dueCount > 0 && <span className="ml-2 rounded-full bg-[#fcebc4] px-2 py-0.5 text-[10px] text-[#8f6422] dark:bg-[#2d2218] dark:text-[#d4aa61]">{dueCount} due</span>}</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 px-2 pb-3">{children}</div>
    </details>
  );
}
