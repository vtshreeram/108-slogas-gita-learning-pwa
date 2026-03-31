import { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Repeat, Repeat1, Undo2 } from "lucide-react";

type AudioPlayerProps = {
  audioSrc: string;
  isFirst: boolean;
  isLast: boolean;
  audioAvailable: boolean;
  setAudioAvailable: (v: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
};

export function AudioPlayer({
  audioSrc, isFirst, isLast,
  audioAvailable, setAudioAvailable,
  onNext, onPrev
}: AudioPlayerProps) {
  const [audioState, setAudioState] = useState<"idle" | "playing" | "paused" | "unavailable">("idle");
  const [audioLoop, setAudioLoop] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = async () => {
    if (!audioRef.current || !audioAvailable) return;
    try { await audioRef.current.play(); setAudioState("playing"); }
    catch { setAudioAvailable(false); setAudioState("unavailable"); }
  };

  const pauseAudio = () => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.pause();
    setAudioState("paused");
  };

  const stopAudio = () => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setAudioState("idle");
  };

  const togglePlayPause = async () => {
    if (!audioRef.current || !audioAvailable) return;
    if (audioState === "playing") pauseAudio();
    else await playAudio();
  };

  const seekAudio = (nextTime: number) => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.currentTime = nextTime;
    setAudioCurrentTime(nextTime);
  };

  const toggleLoopMode = () => {
    if (!audioLoop && !autoAdvance) setAudioLoop(true);
    else if (audioLoop) { setAudioLoop(false); setAutoAdvance(true); }
    else setAutoAdvance(false);
  };

  const formatTime = (secs: number) => {
    const total = Math.max(0, Math.floor(secs));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setAudioAvailable(true);
    setAudioCurrentTime(0);
    setAudioDuration(0);

    if (pendingAutoPlay) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => { setAudioState("playing"); })
          .catch(() => { setAudioState("unavailable"); setAudioAvailable(false); })
          .finally(() => { setPendingAutoPlay(false); });
      }
    } else {
      setAudioState("idle");
    }
  }, [audioSrc, pendingAutoPlay, setAudioAvailable]);

  const loopActive = audioLoop || autoAdvance;

  return (
    <section aria-label="Audio player" className="fixed bottom-0 left-0 right-0 border-t border-[#ebd6ab] bg-[#fffcf5]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-[0_-8px_24px_rgba(143,100,34,0.05)] z-40">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setAudioDuration(e.currentTarget.duration)}
          onEnded={() => {
            if (audioLoop) { audioRef.current!.currentTime = 0; playAudio(); }
            else if (autoAdvance && !isLast) { setPendingAutoPlay(true); onNext(); }
            else setAudioState("idle");
          }}
          onError={() => { setAudioAvailable(false); setAudioState("unavailable"); }}
        />

        <div className="flex items-center gap-3">
          <span className="w-10 text-right text-xs font-medium tabular-nums text-[#a88d63]">{formatTime(audioCurrentTime)}</span>
          <div
            className="group relative h-8 flex-1 cursor-pointer touch-none flex items-center"
            onPointerDown={(e) => {
              const el = e.currentTarget;
              const update = (ev: PointerEvent) => {
                const rect = el.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                seekAudio(pct * (audioDuration || 0));
              };
              update(e as unknown as PointerEvent);
              el.setPointerCapture(e.pointerId);
              el.onpointermove = update;
              el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; el.releasePointerCapture(e.pointerId); };
            }}
          >
            <div className="absolute left-0 right-0 h-2 rounded-full bg-[#f4e9cb] overflow-hidden">
              <div className="h-full bg-[#c0a986] transition-all duration-100 ease-linear" style={{ width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` }} />
            </div>
          </div>
          <span className="w-10 text-xs font-medium tabular-nums text-[#a88d63]">{formatTime(audioDuration)}</span>
        </div>

        <div className="flex items-center justify-between px-2">
          <button onClick={toggleLoopMode} aria-label={audioLoop ? "Loop current" : autoAdvance ? "Auto-advance" : "No loop"} className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${loopActive ? "bg-[#fcebc4] text-[#8f6422]" : "text-[#b0976e]"}`}>
            {audioLoop ? <Repeat1 className="h-5 w-5" /> : autoAdvance ? <Repeat className="h-5 w-5" /> : <Repeat className="h-5 w-5 opacity-50" />}
          </button>

          <div className="flex items-center gap-4">
            <button onClick={onPrev} disabled={isFirst} aria-label="Previous shloka" className="flex h-12 w-12 items-center justify-center rounded-full text-[#5c431b] disabled:opacity-30">
              <Undo2 className="h-6 w-6" />
            </button>
            <button onClick={togglePlayPause} disabled={!audioAvailable} className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4a3615] text-[#fcebc4] shadow-[0_4px_12px_rgba(74,54,21,0.2)] disabled:opacity-50 transition-transform active:scale-95">
              {audioState === "playing" ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current ml-1" />}
            </button>
            <button onClick={stopAudio} disabled={audioState === "idle" || !audioAvailable} aria-label="Stop playback" className="flex h-12 w-12 items-center justify-center rounded-full text-[#5c431b] disabled:opacity-30">
              <Square className="h-5 w-5 fill-current" />
            </button>
          </div>

          <button onClick={() => { setPendingAutoPlay(true); onNext(); }} disabled={isLast} aria-label="Next shloka" className="flex h-10 w-10 items-center justify-center rounded-full text-[#b0976e] disabled:opacity-30">
            <Undo2 className="h-5 w-5 rotate-180" />
          </button>
        </div>
      </div>
    </section>
  );
}
