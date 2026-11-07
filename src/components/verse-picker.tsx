"use client";

import { useMemo, useState } from "react";
import { Search, Star, Check } from "lucide-react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DialogCard } from "@/components/dialog-card";
import { SHLOKAS } from "@/lib/shlokas";
import { fullDone, type ItemProgress } from "@/lib/constants";
import { filterVerses } from "@/lib/verse-search";
import type { GitaVerse } from "@/lib/gita-verses";

type Props = {
  current: GitaVerse; verses: GitaVerse[] | null; favorites: string[];
  completed: ItemProgress; failed: number[]; onRetry: () => void;
  onPick: (verse: GitaVerse) => void;
};

export function VersePicker({ current, verses, favorites, completed, failed, onRetry, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [chapter, setChapter] = useState("");
  const [collection, setCollection] = useState("all");
  const [limit, setLimit] = useState(40);
  const matches = useMemo(() => {
    const source = verses ?? SHLOKAS.map((v) => ({ ...v, important: true }));
    const filtered = filterVerses(source, { text, chapter: chapter ? Number(chapter) : null, filter: collection === "selected" ? "important" : "all" });
    return filtered.filter((v) => collection === "favorites" ? favorites.includes(v.id) : collection === "learned" ? fullDone(completed[v.id]) : true);
  }, [verses, text, chapter, collection, favorites, completed]);

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
      {!verses && <p className="study-muted text-sm" role="status">Loading the full collection. The selected 108 are available now.</p>}
      {failed.length > 0 && <div className="text-sm" role="status"><p>Could not load chapters {failed.join(", ")}. Available verses are shown.</p><button className="study-button mt-2" onClick={onRetry}>Retry chapters</button></div>}
      <p className="study-muted text-sm" role="status">{matches.length} matching {matches.length === 1 ? "verse" : "verses"}</p>
      <div className="verse-results">
        {matches.slice(0, limit).map((v) => <button key={v.id} className="verse-result" aria-current={current.id === v.id ? "true" : undefined} onClick={() => { onPick(v); setOpen(false); }}>
          <span className="flex items-center gap-2 font-semibold">Verse {v.reference}{favorites.includes(v.id) && <Star className="h-4 w-4" aria-label="Favorite" />}{fullDone(completed[v.id]) && <Check className="h-4 w-4" aria-label="Learned" />}</span>
          <span className="study-muted block text-sm">{v.important ? "Selected 108 · " : "Read · "}{v.transliteration.split("\n")[0]}</span>
        </button>)}
        {!matches.length && <p className="py-5 text-sm">No verses found. Try another word, chapter, or collection.</p>}
        {matches.length > limit && <button className="study-button my-3 w-full" onClick={() => setLimit(limit + 40)}>Show more verses</button>}
      </div>
    </DialogCard>
  </Dialog>;
}
