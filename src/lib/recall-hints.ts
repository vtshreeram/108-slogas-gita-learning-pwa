/**
 * One entry per line of the verse for the recall prompt: the full line once revealed,
 * its first word followed by an ellipsis when first-word hints are on, otherwise null.
 */
export function recallHintLines(transliteration: string, revealedLines: number, firstWords: boolean): (string | null)[] {
  return transliteration
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      if (i < revealedLines) return line;
      return firstWords ? `${line.trim().split(/\s+/)[0]} …` : null;
    });
}
