"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { GITA_CHAPTERS, loadChapter, type GitaVerse } from "@/lib/gita-verses";

type Props = {
  /** Jump into the learning loop for one of the curated 108 (by GS id). */
  onStudy: (id: string) => void;
};

export function ChapterBrowser({ onStudy }: Props) {
  const [chapter, setChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<GitaVerse[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (chapter === null) return;
    let cancelled = false;
    setVerses(null); setError(""); setOpen(null);
    loadChapter(chapter).then((v) => { if (!cancelled) setVerses(v); }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this chapter. Try again."); });
    return () => { cancelled = true; };
  }, [chapter]);

  const importantCount = verses?.filter((v) => v.important).length ?? 0;

  return (
    <section aria-label="Browse all verses" className="rounded-2xl bg-[#fffaf0] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] p-3 sm:p-4">
      <h2 className="text-[10px] font-bold tracking-widest text-[#705735] dark:text-[#bda27e] uppercase mb-2">All verses by chapter</h2>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chapters">
        {GITA_CHAPTERS.map((c) => (
          <button
            key={c}
            aria-pressed={chapter === c}
            onClick={() => setChapter(chapter === c ? null : c)}
            className={`min-w-9 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${chapter === c ? "bg-[#8f6422] text-white dark:bg-[#d4aa61] dark:text-[#1e1710]" : "bg-[#fcebc4] dark:bg-[#2d2218] text-[#5c431b] dark:text-[#f0e3ce]"}`}
          >{c}</button>
        ))}
      </div>

      {chapter !== null && (
        <div className="mt-3">
          {error && <p className="text-sm text-[#705735] dark:text-[#bda27e]" role="status">{error}</p>}
          {!error && !verses && <p className="text-sm text-[#705735] dark:text-[#bda27e]">Loading chapter {chapter}…</p>}
          {verses && (
            <>
              <p className="mb-2 flex items-center gap-1.5 text-xs text-[#705735] dark:text-[#bda27e]">
                Chapter {chapter} · {verses.length} verses ·
                <Star className="h-3 w-3 fill-[#d4aa61] text-[#d4aa61]" aria-hidden /> {importantCount} important
              </p>
              <ul className="divide-y divide-[#f4e9cb] dark:divide-[#423321]">
                {verses.map((v) => {
                  const expanded = open === v.id;
                  return (
                    <li key={v.id} className={v.important ? "bg-[#fff4d9]/70 dark:bg-[#2b2213]" : ""}>
                      <button
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : v.id)}
                        className="flex w-full min-h-11 items-start gap-2 px-2 py-2 text-left"
                      >
                        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-[#705735] dark:text-[#bda27e]">{v.reference}</span>
                        {v.important && <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-[#d4aa61] text-[#d4aa61]" aria-label="Important verse" />}
                        <span className="line-clamp-2 text-sm text-[#4a3615] dark:text-[#f0e3ce]">{v.english}</span>
                      </button>
                      {expanded && (
                        <div className="px-2 pb-3 pl-14 space-y-2">
                          <p lang="sa" className="whitespace-pre-wrap text-base leading-relaxed text-[#4a3615] dark:text-[#f0e3ce]">{v.sanskrit}</p>
                          <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-[#5c431b] dark:text-[#e6d6bc]">{v.transliteration}</p>
                          <p lang="en" className="text-sm leading-relaxed text-[#5c431b] dark:text-[#f0e3ce]">{v.english}</p>
                          <p className="text-[11px] text-[#8a6b3d] dark:text-[#bda27e]">{v.translationAuthor}</p>
                          {v.tamil && <p lang="ta" className="whitespace-pre-wrap text-sm leading-relaxed font-[family-name:var(--font-noto-sans-tamil)] text-[#3d2c10] dark:text-[#f0e3ce]">{v.tamil}</p>}
                          {v.important && (
                            <button
                              onClick={() => { onStudy(v.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                              className="rounded-full bg-[#8f6422] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#d4aa61] dark:text-[#1e1710]"
                            >Study this verse</button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
