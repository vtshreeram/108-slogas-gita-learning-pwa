"use client";

import { lazy, Suspense, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import type { GuidedPracticeProps } from "@/components/guided-practice-content";
import { fullDone } from "@/lib/constants";

const GuidedPracticeContent = lazy(() => import("@/components/guided-practice-content"));

export function GuidedPractice(props: GuidedPracticeProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const title = fullDone(props.progress) ? "Learned · Practice again" : "Memorize this verse";

  return <details className="practice-panel" onToggle={(event) => {
    if (event.target === event.currentTarget && event.currentTarget.open) setHasOpened(true);
  }}>
    <summary className="practice-summary">
      <span className="tool-symbol"><Brain className="h-4 w-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="study-muted block text-xs">Listen, repeat, understand, recall</span></span>
      <ChevronDown className="disclosure-chevron h-4 w-4 shrink-0" aria-hidden="true" />
    </summary>
    {hasOpened && <Suspense fallback={<p className="study-muted text-sm" role="status">Loading practice…</p>}>
      <GuidedPracticeContent {...props} />
    </Suspense>}
  </details>;
}
