"use client";
import { RefObject, useEffect, useRef, useState } from "react";
import { Shloka } from "@/lib/shlokas";
import { tamilChant } from "@/lib/tamil-chant";
import { AUDIO_TRANSPORT_EVENT, currentLine, nextLineTurn, validLineCues } from "@/lib/line-practice";

type Props = { shloka: Shloka; audioRef: RefObject<HTMLAudioElement | null>; cues?: number[]; onSave: (cues: number[] | null) => void; onActiveChange: (active: boolean) => void };
export function LinePractice({ shloka, audioRef, cues, onSave, onActiveChange }: Props) {
  const lines = shloka.transliteration.split("\n").filter((line) => line.trim());
  const [script, setScript] = useState<"roman" | "tamil">("roman");
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [mode, setMode] = useState<"off" | "marking" | "practice">("off");
  const [draft, setDraft] = useState<number[]>([]);
  const [selected, setSelected] = useState(0);
  const [repeats, setRepeats] = useState(2);
  const [advance, setAdvance] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turn = useRef({ line: 0, repetition: 0 });
  const waitingRef = useRef(false);
  const usable = validLineCues(cues, lines.length, duration);
  const activeLine = mode === "marking" ? draft.length - 1 : usable ? currentLine(cues, position) : -1;
  const clearWait = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; waitingRef.current = false; setWaiting(false); };
  const stop = () => { clearWait(); setMode("off"); };
  useEffect(() => { onActiveChange(mode !== "off"); return () => onActiveChange(false); }, [mode, onActiveChange]);
  useEffect(() => {
    const audio = audioRef.current; if (!audio) return;
    const update = () => { setPosition(audio.currentTime); setDuration(Number.isFinite(audio.duration) ? audio.duration : 0); };
    update(); audio.addEventListener("timeupdate", update); audio.addEventListener("loadedmetadata", update); audio.addEventListener("emptied", update);
    return () => { audio.removeEventListener("timeupdate", update); audio.removeEventListener("loadedmetadata", update); audio.removeEventListener("emptied", update); };
  }, [audioRef]);
  useEffect(() => {
    const external = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; waitingRef.current = false; setWaiting(false); setMode("off"); };
    window.addEventListener(AUDIO_TRANSPORT_EVENT, external);
    return () => { window.removeEventListener(AUDIO_TRANSPORT_EVENT, external); if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || mode !== "practice" || !usable) return;
    const finish = () => {
      if (waitingRef.current) return;
      const { line, repetition } = turn.current;
      if (audio.currentTime < cues[line + 1] - 0.04) return;
      audio.pause(); waitingRef.current = true; setWaiting(true);
      const seconds = Math.max(1, (cues[line + 1] - cues[line]) / audio.playbackRate);
      timer.current = setTimeout(() => {
        const next = nextLineTurn(line, repetition, repeats, lines.length, advance);
        waitingRef.current = false; setWaiting(false); timer.current = null;
        if (!next) { setMode("off"); setMessage("Practice finished. Try recalling the verse."); return; }
        turn.current = next; setSelected(next.line); audio.currentTime = cues[next.line];
        void audio.play().catch(() => { setMode("off"); setMessage("Tap Play to resume audio; your line timings are saved."); });
      }, seconds * 1000);
    };
    audio.addEventListener("timeupdate", finish); audio.addEventListener("ended", finish);
    return () => { audio.removeEventListener("timeupdate", finish); audio.removeEventListener("ended", finish); if (timer.current) clearTimeout(timer.current); timer.current = null; waitingRef.current = false; };
  }, [mode, usable, cues, repeats, lines.length, advance, audioRef]);

  async function start() {
    const audio = audioRef.current; if (!audio || !usable) return;
    clearWait(); turn.current = { line: selected, repetition: 0 }; setMode("practice");
    audio.currentTime = cues[selected];
    try { await audio.play(); setMessage(""); } catch { setMode("off"); setMessage("Could not play this line. Try the audio player's Play button first."); }
  }
  function markEnd() {
    const audio = audioRef.current; if (!audio) return;
    if (audio.currentTime - draft[draft.length - 1] < 0.1) { setMessage("Let the line finish before marking its end."); return; }
    const next = [...draft, Math.min(audio.currentTime, duration)];
    setDraft(next);
    if (next.length === lines.length + 1) {
      audio.pause(); onSave(next); setMode("off"); setMessage("Line timings saved for this recording. You can now practise each line.");
    } else setMessage(`Now listen to line ${next.length}.`);
  }
  return <details className="study-panel" onToggle={(e) => { if (!e.currentTarget.open && mode !== "off") { stop(); audioRef.current?.pause(); } }}>
    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-sm">Line-by-line practice</summary>
    <p className="study-muted my-2 text-sm">Listen to a line, then chant during the quiet pause.</p>
    <div className="mb-3 flex flex-wrap gap-2">
      <button className="study-button" aria-pressed={script === "roman"} onClick={() => setScript("roman")}>Roman</button>
      <button className="study-button" aria-pressed={script === "tamil"} onClick={() => setScript("tamil")}>தமிழ் உச்சரிப்பு</button>
    </div>
    <ol className="space-y-1">
      {lines.map((line, index) => <li key={index}><button className={`w-full rounded-lg border px-3 py-2 text-left leading-loose ${activeLine === index ? "border-[var(--study-ink)] bg-[var(--study-accent)] font-semibold" : "border-transparent"}`} aria-current={activeLine === index ? "step" : undefined} aria-pressed={selected === index} disabled={mode !== "off"} onClick={() => { setSelected(index); if (usable && audioRef.current) audioRef.current.currentTime = cues[index]; }}>
        <span className="study-muted mr-2 text-xs">{index + 1}.</span><span lang={script === "tamil" ? "ta" : "sa-Latn"}>{script === "tamil" ? tamilChant(line) : line}</span>{selected === index && <span className="sr-only">Selected</span>}
      </button></li>)}
    </ol>
    <p className="my-2 text-sm" role="status">{waiting ? "Your turn — chant this line" : mode === "marking" ? message || `Mark the end of line ${draft.length} while listening.` : message}</p>
    {usable && <div className="my-3 flex flex-wrap items-center gap-3">
      <label className="text-sm">Repetitions <select className="study-input ml-1" disabled={mode !== "off"} value={repeats} onChange={(e) => setRepeats(Number(e.target.value))}>{[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={advance} disabled={mode !== "off"} onChange={(e) => setAdvance(e.target.checked)} />Continue to next line</label>
      {mode === "off" ? <button className="study-button study-primary" onClick={() => void start()}>Practise from line {selected + 1}</button> : <button className="study-button" onClick={() => { stop(); audioRef.current?.pause(); }}>Stop practice</button>}
    </div>}
    {!usable && mode === "off" && <p className="my-3 text-sm">Set timings once for this recording: play the verse and mark where each line ends. This keeps the highlighting matched to the actual chant.</p>}
    {mode === "marking" ? <div className="flex flex-wrap gap-2"><button className="study-button study-primary" onClick={markEnd}>Mark end of line {draft.length}</button><button className="study-button" onClick={() => { stop(); audioRef.current?.pause(); }}>Cancel</button></div> : mode === "off" && <div className="flex flex-wrap gap-2">
      <button className="study-button" disabled={!duration} onClick={() => { const audio = audioRef.current; if (!audio) return; audio.pause(); audio.currentTime = 0; setDraft([0]); setMode("marking"); setMessage(""); void audio.play().catch(() => { setMode("off"); setMessage("Press Play in the audio player, then try setting timings again."); }); }}>{usable ? "Record new line timings" : "Set line timings"}</button>
      {cues && <button className="study-button" onClick={() => { stop(); onSave(null); }}>Reset timings</button>}
    </div>}
  </details>;
}
