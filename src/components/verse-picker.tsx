"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Star, Check } from "lucide-react";
import * as D from "@radix-ui/react-dialog";
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

  // Track the visible viewport so the dialog shrinks above the on-screen keyboard instead of overflowing.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
      document.documentElement.style.setProperty("--vvt", `${vv.offsetTop}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--vvh");
      document.documentElement.style.removeProperty("--vvt");
    };
  }, [open]);
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
  return <D.Root open={open} onOpenChange={setOpen}>
    <D.Trigger asChild><button className="icon-button theme-button" aria-label="Find a verse"><Search className="h-4 w-4" aria-hidden="true" /></button></D.Trigger>
    <D.Portal><D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" /><D.Content className="vp-sheet" aria-describedby={undefined}>
      <D.Title className="sr-only">Find a verse</D.Title>
      <div className="vp-bar">
        <div className="vp-field"><Search className="h-4 w-4" aria-hidden="true" /><input id="verse-search" type="search" aria-label="Search verses" className="vp-input" placeholder="Search 2.47, karma, கிருஷ்ண…" value={text} onChange={(e) => { setText(e.target.value); setLimit(40); }} /></div>
        <D.Close className="vp-cancel">Cancel</D.Close>
      </div>
      <div className="vp-chips" role="group" aria-label="Collection">
        {[["all", "All"], ["selected", "Selected 108"], ["favorites", "Favorites"], ["learned", "Learned"]].map(([v, label]) => <button key={v} className="vp-chip" aria-pressed={collection === v} onClick={() => { setCollection(v); setLimit(40); }}>{label}</button>)}
      </div>
      <div className="vp-chips" role="group" aria-label="Chapter">
        <button className="vp-chip" aria-pressed={chapter === ""} onClick={() => { setChapter(""); setLimit(40); }}>All chapters</button>
        {Array.from({ length: 18 }, (_, i) => <button key={i} className="vp-chip" aria-pressed={chapter === String(i + 1)} onClick={() => { setChapter(String(i + 1)); setLimit(40); }}>Ch {i + 1}</button>)}
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
    </D.Content></D.Portal>
  </D.Root>;
}
