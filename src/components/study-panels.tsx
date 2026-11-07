"use client";
import type { Shloka } from "@/lib/shlokas";
import { ReviewQueue } from "@/components/review-queue";
import { LinePractice } from "@/components/line-practice";
import { VerseStudy } from "@/components/verse-study";
import { OfflineLibrary } from "@/components/offline-library";

type Review = React.ComponentProps<typeof ReviewQueue>;
type Practice = React.ComponentProps<typeof LinePractice>;
type Props = {
  active: Shloka;
  due: Review["due"]; reviews: Review["reviews"]; onRate: Review["onRate"]; onJump: Review["onJump"];
  audioRef: Practice["audioRef"]; cues: Practice["cues"]; onSaveCues: Practice["onSave"]; onLinePracticeActive: Practice["onActiveChange"];
};

/** Everything inside "Study tools". Loaded as one separate chunk the first time the section is opened (or idle-prefetched). */
export function StudyPanels({ active, due, reviews, onRate, onJump, audioRef, cues, onSaveCues, onLinePracticeActive }: Props) {
  return <>
    <ReviewQueue due={due} reviews={reviews} onRate={onRate} onJump={onJump} />
    <LinePractice key={active.id} shloka={active} audioRef={audioRef} cues={cues} onSave={onSaveCues} onActiveChange={onLinePracticeActive} />
    <VerseStudy shloka={active} />
    <OfflineLibrary reference={active.reference} />
  </>;
}
