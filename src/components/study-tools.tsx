"use client";
import { ReactNode } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

export function StudyTools({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <details className="tools-disclosure group" onToggle={(event) => { if (event.target === event.currentTarget && !event.currentTarget.open) onClose(); }}>
    <summary className="practice-summary"><span className="tool-symbol"><BookOpen className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1 font-semibold">Pronunciation & offline tools</span><ChevronDown className="disclosure-chevron h-4 w-4 shrink-0" aria-hidden="true" /></summary>
    <div className="mt-3 space-y-4">{children}</div>
  </details>;
}
