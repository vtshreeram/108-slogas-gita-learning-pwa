"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Star, Check } from "lucide-react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DialogCard } from "@/components/dialog-card";
import { SHLOKAS } from "@/lib/shlokas";
import { fullDone, type ItemProgress } from "@/lib/constants";
import { filterVerses, parseReference } from "@/lib/verse-search";
import { loadAllChapters, type GitaVerse } from "@/lib/gita-verses";
import { VERSE_INDEX, indexCovering } from "@/lib/verse-index";

type Props = {
  current: GitaVerse; favorites: string[]; completed: ItemProgress;
  /** Index into the 657-verse reference index; the page loads only that verse's chapter. */
  onPick: (index: number) => void;
};

const SHLOKA_BY_REFERENCE = new Map(SHLOKAS.map((s) => [s.reference, s]));

/**
 * Lists all 657 verses from the reference-only index, so opening the picker downloads nothing.
 * Chapter text is fetched (once) only when the learner types words to search for.
 */
export function VersePicker({ current, favorites, completed, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [chapter, setChapter] = useState("");
  const [collection, setCollection] = useState("all");
  const [limit, setLimit] = useState(40);
  const [loaded, setLoaded] = useState<{ verses: GitaVerse[]; failed: number[] } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const query = text.trim();
  const wordSearch = query !== "" && !parseReference(query);

  useEffect(() => {
    if (!open || !wordSearch || (loaded && loaded.failed.length === 0)) return;
    let cancelled = false;
    void loadAllChapters().then((result) => { if (!cancelled) setLoaded(result); });
    return () => { cancelled = true; };
  }, [open, wordSearch, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const byReference = useMemo(() => new Map((loaded?.verses ?? []).map((v) => [v.reference, v])), [loaded]);
  const idOf = (reference: string) => SHLOKA_BY_REFERENCE.get(reference)?.id ?? `BG-${reference}`;

  const matches = useMemo(() => {
    let allowed: Set<string> | null = null;
    if (query) {
      const ref = parseReference(query);
      if (ref) { const i = indexCovering(ref.chapter, ref.verse); allowed = new Set(i >= 0 ? [VERSE_INDEX[i].reference] : []); }
      else if (loaded) allowed = new Set(filterVerses(loaded.verses, { text: query, chapter: null, filter: "all" }).map((v) => v.reference));
      else allowed = new Set(VERSE_INDEX.filter((e) => e.reference.includes(query)).map((e) => e.reference));
    }
    return VERSE_INDEX.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
      if (allowed && !allowed.has(entry.reference)) return false;
      if (chapter && entry.chapter !== Number(chapter)) return false;
      if (collection === "selected") return entry.important;
      if (collection === "favorites") return favorites.includes(idOf(entry.reference));
      if (collection === "learned") return fullDone(completed[idOf(entry.reference)]);
      return true;
    });
  }, [query, loaded, chapter, collection, favorites, completed]);

  const failed = loaded?.failed ?? [];
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button className="study-button min-w-11" aria-label="Find a verse"><Search className="h-4 w-4" aria-hidden="true" /><span className="hidden min-[380px]:inline">Find a verse</span></button></DialogTrigger>
    <DialogCard maxWidth="max-w-lg">
      <DialogHeader><DialogTitle>Find a verse</DialogTitle><DialogDescription>Search by reference, Sanskrit, English, or Tamil words.</DialogDescription></DialogHeader>
      <label className="text-sm font-medium" htmlFor="verse-search">Search all chapters</label>
      <input id="verse-search" type="search" className="study-input w-full" placeholder="2.47, karma, கிருஷ்ண…" value={text} onChange={(e) => { setText(e.target.value); setLimit(40); }} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Chapter<select className="study-input mt-1 w-full" value={chapter} onChange={(e) => { setChapter(e.target.value); setLimit(40); }}><option value="">All chapters</option>{Array.from({ length: 18 }, (_, i) => <option key={i} value={i + 1}>Chapter {i + 1}</option>)}</select></label>
        <label className="text-sm">Collection<select className="study-input mt-1 w-full" value={collection} onChange={(e) => { setCollection(e.target.value); setLimit(40); }}><option value="all">All verses</option><option value="selected">Selected 108</option><option value="favorites">Favorites</option><option value="learned">Learned</option></select></label>
      </div>
      {wordSearch && !loaded && <p className="study-muted text-sm" role="status">Loading verse text to search. References match meanwhile.</p>}
      {failed.length > 0 && <div className="text-sm" role="status"><p>Could not load chapters {failed.join(", ")}, so their text is not searched.</p><button className="study-button mt-2" onClick={() => setAttempt((n) => n + 1)}>Retry chapters</button></div>}
      <p className="study-muted text-sm" role="status">{matches.length} matching {matches.length === 1 ? "verse" : "verses"}</p>
      <div className="verse-results">
        {matches.slice(0, limit).map(({ entry, index }) => {
          const id = idOf(entry.reference);
          const line = (SHLOKA_BY_REFERENCE.get(entry.reference) ?? byReference.get(entry.reference))?.transliteration.split("\n")[0];
          return <button key={entry.reference} className="verse-result" aria-current={current.reference === entry.reference ? "true" : undefined} onClick={() => { onPick(index); setOpen(false); }}>
            <span className="flex items-center gap-2 font-semibold">Verse {entry.reference}{favorites.includes(id) && <Star className="h-4 w-4" aria-label="Favorite" />}{fullDone(completed[id]) && <Check className="h-4 w-4" aria-label="Learned" />}</span>
            <span className="study-muted block text-sm">{entry.important ? "Selected 108" : "Read"}{line ? ` · ${line}` : ""}</span>
          </button>;
        })}
        {!matches.length && <p className="py-5 text-sm">No verses found. Try another word, chapter, or collection.</p>}
        {matches.length > limit && <button className="study-button my-3 w-full" onClick={() => setLimit(limit + 40)}>Show more verses</button>}
      </div>
    </DialogCard>
  </Dialog>;
}
