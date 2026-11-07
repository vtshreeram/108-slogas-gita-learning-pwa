"use client";
import { ReactNode, useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

/**
 * The tools mount the first time the section is opened and then stay mounted, so collapsing it never
 * loses line-practice marks. Until then nothing inside is rendered (or downloaded).
 */
export function StudyTools({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const [opened, setOpened] = useState(false);
  return <details className="tools-disclosure group" onToggle={(event) => {
    if (event.target !== event.currentTarget) return;
    if (event.currentTarget.open) setOpened(true); else onClose();
  }}>
    <summary className="practice-summary"><span className="tool-symbol"><BookOpen className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1 font-semibold">Pronunciation & offline tools</span><ChevronDown className="disclosure-chevron h-4 w-4 shrink-0" aria-hidden="true" /></summary>
    <div className="mt-3 space-y-4">{opened && children}</div>
  </details>;
}
