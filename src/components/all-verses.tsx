"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { GITA_CHAPTERS, loadAllChapters, type GitaVerse } from "@/lib/gita-verses";
import { tamilCredit } from "@/lib/shlokas";
import { countVerses, filterVerses, type VerseFilter } from "@/lib/verse-search";

type Props = {
  /** Jump into the learning loop for one of the curated 108 (by GS id). */
  onStudy: (id: string) => void;
};

const ink = "text-[#4a3615] dark:text-[#f0e3ce]";
const muted = "text-[#705735] dark:text-[#bda27e]";

export function AllVerses({ onStudy }: Props) {
  const [verses, setVerses] = useState<GitaVerse[] | null>(null);
  const [failed, setFailed] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<VerseFilter>("all");
  const [chapter, setChapter] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const deferred = useDeferredValue(text);

  useEffect(() => {
    let cancelled = false;
    loadAllChapters().then((r) => { if (!cancelled) { setVerses(r.verses); setFailed(r.failed); } });
    return () => { cancelled = true; };
  }, [attempt]);

  const counts = useMemo(() => countVerses(verses ?? []), [verses]);
  const shown = useMemo(() => filterVerses(verses ?? [], { text: deferred, filter, chapter }), [verses, deferred, filter, chapter]);

  const tabs: { id: VerseFilter; label: string; n: number }[] = [
    { id: "all", label: "All", n: counts.all },
    { id: "important", label: "Important", n: counts.important },
    { id: "others", label: "Others", n: counts.others },
  ];
  const chip = (active: boolean) => `min-w-9 shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${active ? "bg-[#8f6422] text-white dark:bg-[#d4aa61] dark:text-[#1e1710]" : "bg-[#fcebc4] dark:bg-[#2d2218] text-[#5c431b] dark:text-[#f0e3ce]"}`;

  let lastChapter = 0;
  return (
    <section aria-label="All verses" className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 rounded-2xl border border-[#f0d498] bg-[#fffaf0] p-3 dark:border-[#423321] dark:bg-[#1e1710]">
        <label className="relative block">
          <span className="sr-only">Search verses</span>
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} aria-hidden />
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Search: 2.47, krishna, செயல்…"
            className={`min-h-11 w-full rounded-xl border border-[#ebd6ab] bg-white py-2 pl-9 pr-3 text-base dark:border-[#423321] dark:bg-[#15100a] ${ink}`}
          />
        </label>
        <div className="flex gap-1.5" role="group" aria-label="Show">
          {tabs.map((t) => (
            <button key={t.id} aria-pressed={filter === t.id} onClick={() => setFilter(t.id)} className={`${chip(filter === t.id)} min-h-9 flex-1`}>
              {t.id === "important" && <Star className="mr-1 inline h-3 w-3 -translate-y-px fill-current" aria-hidden />}
              {t.label}{verses && <span className="ml-1 font-normal opacity-80">{t.n}</span>}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Chapters">
          <button aria-pressed={chapter === null} onClick={() => setChapter(null)} className={chip(chapter === null)}>All</button>
          {GITA_CHAPTERS.map((c) => <button key={c} aria-pressed={chapter === c} onClick={() => setChapter(chapter === c ? null : c)} className={chip(chapter === c)}>{c}</button>)}
        </div>
        <p className={`flex items-center gap-1.5 text-[11px] ${muted}`}>
          <span className="inline-block h-3 w-1 rounded-sm bg-[#d4aa61]" aria-hidden /> Tinted rows with a star are the important 108 you learn in the app.
        </p>
      </div>

      {!verses && <p className={`px-2 py-6 text-center text-sm ${muted}`} role="status">Loading all verses…</p>}
      {verses && failed.length > 0 && (
        <p className={`rounded-xl bg-[#fcebc4] px-3 py-2 text-xs dark:bg-[#2d2218] ${muted}`} role="status">
          Chapter{failed.length > 1 ? "s" : ""} {failed.join(", ")} could not be loaded.{" "}
          <button className="font-semibold underline" onClick={() => { setVerses(null); setAttempt((n) => n + 1); }}>Retry</button>
        </p>
      )}
      {verses && shown.length === 0 && <p className={`px-2 py-6 text-center text-sm ${muted}`} role="status">No verses match.</p>}

      {verses && shown.length > 0 && (
        <>
          <p className={`px-1 text-xs ${muted}`} role="status">{shown.length} verse{shown.length === 1 ? "" : "s"}</p>
          <ul className="overflow-hidden rounded-2xl border border-[#f0d498] bg-[#fffaf0] dark:border-[#423321] dark:bg-[#1e1710]">
            {shown.map((v) => {
              const expanded = open === v.id;
              const heading = v.chapter !== lastChapter && chapter === null;
              lastChapter = v.chapter;
              const credit = tamilCredit(v);
              return (
                <li key={v.id}>
                  {heading && <p className={`border-y border-[#f0d498] bg-[#fcebc4]/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest dark:border-[#423321] dark:bg-[#2d2218]/70 ${muted}`}>Chapter {v.chapter}</p>}
                  <div className={`border-b border-[#f4e9cb] dark:border-[#423321] border-l-[3px] ${v.important ? "border-l-[#d4aa61] dark:border-l-[#d4aa61] bg-[#fff4d9]/70 dark:bg-[#2b2213]" : "border-l-transparent dark:border-l-transparent"}`}>
                    <button aria-expanded={expanded} onClick={() => setOpen(expanded ? null : v.id)} className="flex min-h-11 w-full items-start gap-2 px-2 py-2 text-left">
                      <span className={`w-14 shrink-0 text-xs font-semibold tabular-nums ${muted}`}>{v.reference}</span>
                      <span className="mt-0.5 h-3.5 w-3.5 shrink-0">{v.important && <Star className="h-3.5 w-3.5 fill-[#d4aa61] text-[#d4aa61]" aria-label="Important verse" />}</span>
                      <span className={`line-clamp-2 text-sm ${ink}`}>{v.english}</span>
                    </button>
                    {expanded && (
                      <div className="space-y-2 px-3 pb-3 pl-16">
                        <p lang="sa" className={`whitespace-pre-wrap text-base leading-relaxed ${ink}`}>{v.sanskrit}</p>
                        <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-[#5c431b] dark:text-[#e6d6bc]">{v.transliteration}</p>
                        <p lang="en" className="text-sm leading-relaxed text-[#5c431b] dark:text-[#f0e3ce]">{v.english}</p>
                        <p className="text-[11px] text-[#8a6b3d] dark:text-[#bda27e]">{v.translationAuthor}</p>
                        {v.tamil && (
                          <div>
                            <p lang="ta" className="whitespace-pre-wrap text-sm leading-relaxed font-[family-name:var(--font-noto-sans-tamil)] text-[#3d2c10] dark:text-[#f0e3ce]">{v.tamil}</p>
                            <p lang="ta" className="text-[11px] text-[#8a6b3d] dark:text-[#bda27e]">{credit.label}</p>
                          </div>
                        )}
                        {v.important && (
                          <button onClick={() => onStudy(v.id)} className="rounded-full bg-[#8f6422] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#d4aa61] dark:text-[#1e1710]">Study this verse</button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
