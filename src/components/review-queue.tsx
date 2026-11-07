"use client";
import { useEffect, useState } from "react";
import { RecallRating, ReviewSchedule } from "@/lib/constants";
import { Shloka } from "@/lib/shlokas";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogCard } from "./dialog-card";
import { addDays } from "@/lib/learning-progress";
import { todayIso } from "@/lib/constants";

export function ReviewQueue({ due, reviews, onRate, onJump }: { due: Shloka[]; reviews: Record<string, ReviewSchedule>; onRate: (id: string, rating: RecallRating) => void; onJump: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const active = due[Math.min(index, Math.max(0, due.length - 1))];
  useEffect(() => { setRevealed(false); }, [active?.id]);
  const nextDates = Object.values(reviews).map((r) => r.dueDate).filter((d) => d > todayIso()).sort();
  function rate(rating: RecallRating) {
    if (!active) return;
    const interval = rating === "forgot" ? 0 : rating === "difficult" ? 1 : Math.min(365, Math.max(3, Math.round((reviews[active.id]?.intervalDays ?? 1) * 2.5)));
    onRate(active.id, rating); setRevealed(false);
    setMessage(`Verse ${active.reference}: ${interval === 0 ? "practise again today" : `next review ${addDays(todayIso(), interval)}`}.`);
    // A forgotten verse stays due, but other pending verses get their turn first.
    if (rating === "forgot" && due.length > 1) setIndex((Math.min(index, due.length - 1) + 1) % due.length);
    else setIndex(0);
  }
  return <section className="study-panel">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">Review today <span className="study-muted">({due.length})</span></h2><p className="study-muted mt-1 text-xs">{due.length ? "Recall learned verses before starting new ones." : nextDates.length ? `All caught up. Next review: ${nextDates[0]}.` : "Learn a verse to start your revision schedule."}</p></div>
      <button className="study-button study-primary" disabled={!due.length} onClick={() => { setIndex(0); setRevealed(false); setMessage(""); setOpen(true); }}>Start review</button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogCard maxWidth="max-w-lg">
      <DialogHeader><DialogTitle>Daily revision</DialogTitle><DialogDescription>Recite from memory, reveal the verse, then rate your recall.</DialogDescription></DialogHeader>
      <p className="text-sm" role="status">{message}</p>
      {active ? <div className="space-y-4">
        <h3 className="font-semibold">Verse {active.reference} · {due.length} due</h3>
        {!revealed ? <button className="study-button study-primary w-full" onClick={() => setRevealed(true)}>Reveal verse</button> : <>
          <p className="max-h-52 overflow-y-auto whitespace-pre-line text-center text-lg leading-loose" lang="sa-Latn" tabIndex={0} role="region" aria-label="Verse text">{active.transliteration}</p>
          <p className="text-sm leading-relaxed">{active.english}</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="study-button" onClick={() => rate("forgot")}>Forgot<br />Again today</button>
            <button className="study-button" onClick={() => rate("difficult")}>Difficult<br />Tomorrow</button>
            <button className="study-button study-primary" onClick={() => rate("easy")}>Easy<br />Longer interval</button>
          </div>
        </>}
        <button className="study-button w-full" onClick={() => { onJump(active.id); setOpen(false); }}>Open this verse for practice</button>
      </div> : <p className="py-6">Reviews complete for today. Your next review dates are saved.</p>}
    </DialogCard></Dialog>
  </section>;
}
