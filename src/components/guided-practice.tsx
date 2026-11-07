"use client";

import { useState, type RefObject } from "react";
import { Brain, Check, ChevronDown, Headphones } from "lucide-react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogCard } from "@/components/dialog-card";
import { LOOP_STEPS, STEP_CONFIG, type StepProgress, type RecallRating, type AppState } from "@/lib/constants";
import type { Shloka } from "@/lib/shlokas";
import { AUDIO_TRANSPORT_EVENT } from "@/lib/line-practice";

type Props = {
  verse: Shloka; progress: StepProgress; audioRef: RefObject<HTMLAudioElement | null>;
  onStep: (id: string, step: typeof LOOP_STEPS[number]) => void;
  onRecall: (id: string, rating: RecallRating) => void;
  onContentMode: (mode: AppState["contentMode"]) => void;
  onKnown: () => void; onUndo: () => void;
};

export function GuidedPractice({ verse, progress, audioRef, onStep, onRecall, onContentMode, onKnown, onUndo }: Props) {
  const [listened, setListened] = useState(false);
  const [message, setMessage] = useState("");
  const [recallOpen, setRecallOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const step = LOOP_STEPS.find((name) => !progress[name]);

  async function listen() {
    window.dispatchEvent(new Event(AUDIO_TRANSPORT_EVENT));
    try {
      if (!audioRef.current?.src) throw new Error("Not ready");
      await audioRef.current.play(); setListened(true); setMessage("");
    } catch { setMessage("Audio could not start. Try Play in the audio player, or continue without audio."); }
  }
  function assess(rating: RecallRating) {
    onRecall(verse.id, rating);
    if (rating === "forgot") { setRevealed(false); setMessage("Take another look, then try reciting again. This verse is still in practice."); }
    else { setRecallOpen(false); setMessage(rating === "easy" ? "Verse learned. Review it in 3 days." : "Verse learned. Review it tomorrow."); }
  }

  return <details className="practice-panel">
    <summary className="practice-summary"><span className="tool-symbol"><Brain className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{step ? "Memorize this verse" : "Learned · Practice again"}</span><span className="study-muted block text-xs">Listen, repeat, understand, recall</span></span><ChevronDown className="disclosure-chevron h-4 w-4 shrink-0" aria-hidden="true" /></summary>
    <p className="study-muted mb-4 text-sm">Listen, repeat aloud, read the meaning, then recite from memory. Your place is saved.</p>
    <ol className="practice-steps" aria-label="Learning steps">
      {LOOP_STEPS.map((name, i) => <li key={name} aria-current={step === name ? "step" : undefined}><span>{progress[name] ? <Check className="h-4 w-4" aria-label="Complete" /> : i + 1}</span>{STEP_CONFIG[name].label}</li>)}
    </ol>
    {step === "listen" && <div className="space-y-3"><p>Play the verse and follow the words above.</p><div className="flex flex-wrap gap-2"><button className="study-button study-primary" onClick={() => void listen()}><Headphones className="h-4 w-4" aria-hidden="true" />Play recording</button>{listened ? <button className="study-button" onClick={() => onStep(verse.id, "listen")}>I’ve listened</button> : <button className="study-button" onClick={() => onStep(verse.id, "listen")}>Continue without audio</button>}</div></div>}
    {step === "repeat" && <div className="space-y-3"><p>Repeat the verse aloud. Use the recording or pronunciation tools below as often as you need.</p><button className="study-button study-primary" onClick={() => onStep(verse.id, "repeat")}>I’ve repeated it</button></div>}
    {step === "understand" && <div className="space-y-3"><p>Read the English or Tamil meaning. Explain its message in your own words.</p><div className="flex flex-wrap gap-2"><button className="study-button" onClick={() => { onContentMode("english"); document.getElementById("verse-heading")?.scrollIntoView({ block: "start" }); }}>Read the meaning</button><button className="study-button study-primary" onClick={() => onStep(verse.id, "understand")}>I understand the meaning</button></div></div>}
    {step === "recall" && <div className="space-y-3"><p>Try reciting without looking. Reveal the verse, then honestly rate your recall.</p><button className="study-button study-primary" onClick={() => { audioRef.current?.pause(); window.dispatchEvent(new Event(AUDIO_TRANSPORT_EVENT)); setRevealed(false); setRecallOpen(true); }}>Test my recall</button></div>}
    {!step && <div className="space-y-3"><p>This verse is in your review schedule. You can keep reading or revisit it from your profile.</p><button className="study-button" onClick={onUndo}>Undo learned status</button></div>}
    <p className="mt-3 text-sm" role="status">{message}</p>
    {step && <button className="text-action mt-3" onClick={onKnown}>Already know this verse? Mark as learned</button>}
    <Dialog open={recallOpen} onOpenChange={setRecallOpen}><DialogCard maxWidth="max-w-lg">
      <DialogHeader><DialogTitle>Recall verse {verse.reference}</DialogTitle><DialogDescription>Recite from memory first. Reveal the answer when you are ready to check.</DialogDescription></DialogHeader>
      {message.startsWith("Take another look") && <p className="text-sm" role="status">{message}</p>}
      {!revealed ? <button className="study-button study-primary" onClick={() => setRevealed(true)}>Reveal verse</button> : <>
        <p lang="sa-Latn" className="whitespace-pre-line text-center text-lg leading-loose">{verse.transliteration}</p>
        <div className="grid grid-cols-3 gap-2"><button className="study-button" onClick={() => assess("forgot")}>Forgot</button><button className="study-button" onClick={() => assess("difficult")}>Difficult</button><button className="study-button study-primary" onClick={() => assess("easy")}>Easy</button></div>
        <p className="study-muted text-sm">Forgot keeps it in practice. Difficult schedules tomorrow; Easy schedules a review in 3 days.</p>
      </>}
    </DialogCard></Dialog>
  </details>;
}
