"use client";
import type { Shloka } from "@/lib/shlokas";
import { LinePractice } from "@/components/line-practice";
import { VerseStudy } from "@/components/verse-study";
import { OfflineLibrary } from "@/components/offline-library";

type Practice = React.ComponentProps<typeof LinePractice>;
type Props = {
  active: Shloka;
  audioRef: Practice["audioRef"]; cues: Practice["cues"]; onSaveCues: Practice["onSave"]; onLinePracticeActive: Practice["onActiveChange"];
};

/** Everything inside "Pronunciation & offline tools". Loaded as one separate chunk the first time the section is opened (or idle-prefetched). */
export function StudyPanels({ active, audioRef, cues, onSaveCues, onLinePracticeActive }: Props) {
  return <>
    <LinePractice key={active.id} shloka={active} audioRef={audioRef} cues={cues} onSave={onSaveCues} onActiveChange={onLinePracticeActive} />
    <VerseStudy shloka={active} />
    <OfflineLibrary reference={active.reference} />
  </>;
}
