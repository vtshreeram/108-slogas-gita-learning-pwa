"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Shloka } from "@/lib/shlokas";
import { recallHintLines } from "@/lib/recall-hints";

type Props = {
  verse: Shloka;
  revealed: boolean;
  onReveal: () => void;
  children: ReactNode;
};

export function RecallPrompt({ verse, revealed, onReveal, children }: Props) {
  const [showMeaning, setShowMeaning] = useState(false);
  const [showFirstWords, setShowFirstWords] = useState(false);
  const [revealedLines, setRevealedLines] = useState(0);

  useEffect(() => {
    setShowMeaning(false);
    setShowFirstWords(false);
    setRevealedLines(0);
  }, [verse.id, revealed]);

  if (revealed) return <>{children}</>;

  const hints = recallHintLines(verse.transliteration, revealedLines, showFirstWords);
  const totalLines = hints.length;
  const hasAnyHint = showFirstWords || revealedLines > 0;

  function revealNextLine() {
    const next = revealedLines + 1;
    if (next >= totalLines) onReveal();
    else setRevealedLines(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="study-button" aria-pressed={showMeaning} onClick={() => setShowMeaning((v) => !v)}>
          {showMeaning ? "Hide meaning" : "Meaning cue"}
        </button>
        <button type="button" className="study-button" aria-pressed={showFirstWords} onClick={() => setShowFirstWords((v) => !v)}>
          {showFirstWords ? "Hide first words" : "First words"}
        </button>
        {totalLines > 1 && (
          <button type="button" className="study-button" onClick={revealNextLine}>
            Reveal line {revealedLines + 1} of {totalLines}
          </button>
        )}
      </div>

      {showMeaning && (
        <p className="study-muted rounded-lg border border-current/15 px-3 py-2 text-sm leading-relaxed">
          {verse.english}
        </p>
      )}

      {hasAnyHint && (
        <div lang="sa-Latn" className="space-y-1 rounded-lg border border-current/15 px-3 py-2 text-center text-base leading-relaxed">
          {hints.map((line, i) => (
            <p key={i} className={line ? "" : "study-muted text-xs"}>
              {line ?? "—"}
            </p>
          ))}
        </div>
      )}

      <button type="button" className="study-button study-primary w-full" onClick={onReveal}>
        Reveal verse
      </button>
    </div>
  );
}
