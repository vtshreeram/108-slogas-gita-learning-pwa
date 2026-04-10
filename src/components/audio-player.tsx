/**
 * AudioPlayer - Fixed bottom playback bar
 *
 * Color tokens (defined in globals.css):
 * - --gita-light-* : Light backgrounds & accents
 * - --gita-brown-* : Mid-tone browns, text colors
 * - --gita-dark-* : Dark backgrounds for dark mode
 * - --gita-success-* : Green colors for active/playing states
 *
 * Media Session API for lock screen controls
 */
import { useState, useRef, useEffect } from "react";
import { Play, Pause, Square, Repeat, Loader2, AlertCircle, SkipBack, SkipForward, Gauge } from "lucide-react";

type LoopMode = "off" | "repeat" | "advance";
const REPEAT_COUNTS = [1, 2, 3, 5, 10, Infinity] as const;
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

type AudioPlayerProps = {
  audioSrc: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
  audioAvailable: boolean;
  setAudioAvailable: (v: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
};

export function AudioPlayer({
  audioSrc, title, isFirst, isLast,
  audioAvailable, setAudioAvailable,
  onNext, onPrev
}: AudioPlayerProps) {
  const [audioState, setAudioState] = useState<"idle" | "playing" | "paused" | "unavailable">("idle");
  const [loopMode, setLoopMode] = useState<LoopMode>("off");
  const [repeatCount, setRepeatCount] = useState(1);
  const [currentRepeat, setCurrentRepeat] = useState(0);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = () => {
    if (!audioRef.current || !audioAvailable) return;
    const el = audioRef.current;
    setIsLoading(true);
    const p = el.play();
    if (p) p.then(() => {
      setAudioState("playing");
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    }).catch(() => {
      el.load();
      el.addEventListener("canplay", () => {
        el.play().then(() => {
          setAudioState("playing");
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        }).catch(() => {
          setAudioAvailable(false);
          setAudioState("unavailable");
        });
      }, { once: true });
    });
  };

  const pauseAudio = () => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.pause();
    setAudioState("paused");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  };

  const stopAudio = () => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setAudioState("idle");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !audioAvailable) return;
    if (audioState === "playing") pauseAudio();
    else playAudio();
  };

  const seekAudio = (nextTime: number) => {
    if (!audioRef.current || !audioAvailable) return;
    audioRef.current.currentTime = nextTime;
    setAudioCurrentTime(nextTime);
  };

  const cycleLoopMode = () => {
    if (loopMode === "off") setLoopMode("repeat");
    else if (loopMode === "repeat") setLoopMode("advance");
    else setLoopMode("off");
  };

  const cycleRepeatCount = () => {
    const idx = REPEAT_COUNTS.indexOf(repeatCount as typeof REPEAT_COUNTS[number]);
    setRepeatCount(REPEAT_COUNTS[(idx + 1) % REPEAT_COUNTS.length]);
    setCurrentRepeat(0);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate as typeof SPEED_OPTIONS[number]);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatTime = (secs: number) => {
    const total = Math.max(0, Math.floor(secs));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // Reset on source change
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.playbackRate = playbackRate;
    setAudioAvailable(true);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setCurrentRepeat(0);

    if (pendingAutoPlay) {
      playAudio();
      setPendingAutoPlay(false);
    } else {
      setAudioState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, pendingAutoPlay, setAudioAvailable]);

  // Media Session API — lock screen artwork & controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: "Bhagavad Gita",
      album: "Gita 108",
      artwork: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });

    // Set action handlers with explicit window focus to prevent redirect to other apps
    navigator.mediaSession.setActionHandler("play", () => {
      window.focus();
      playAudio();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      window.focus();
      pauseAudio();
    });
    navigator.mediaSession.setActionHandler("stop", () => {
      window.focus();
      stopAudio();
    });
    navigator.mediaSession.setActionHandler("previoustrack", isFirst ? null : () => {
      window.focus();
      onPrev();
    });
    navigator.mediaSession.setActionHandler("nexttrack", isLast ? null : () => {
      window.focus();
      setPendingAutoPlay(true);
      onNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, isFirst, isLast]);

  const handleEnded = () => {
    if (loopMode === "off") {
      // Reset audio position so user can replay from the start
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setAudioCurrentTime(0);
      setAudioState("idle");
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
      return;
    }

    const nextRepeat = currentRepeat + 1;

    if (loopMode === "repeat") {
      if (repeatCount === Infinity || nextRepeat < repeatCount) {
        setCurrentRepeat(nextRepeat);
        audioRef.current!.currentTime = 0;
        playAudio();
      } else {
        setCurrentRepeat(0);
        // Reset audio position when repeat count reached
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
        setAudioCurrentTime(0);
        setAudioState("idle");
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
      }
    } else if (loopMode === "advance") {
      if (repeatCount === Infinity || nextRepeat < repeatCount) {
        setCurrentRepeat(nextRepeat);
        audioRef.current!.currentTime = 0;
        playAudio();
      } else {
        setCurrentRepeat(0);
        if (!isLast) { setPendingAutoPlay(true); onNext(); }
        else {
          // Reset audio position when done with advance repeats on last shloka
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
          setAudioCurrentTime(0);
          setAudioState("idle");
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "paused";
          }
        }
      }
    }
  };

  const repeatLabel = repeatCount === Infinity ? "∞" : `${repeatCount}x`;
  const loopLabel = loopMode === "off" ? "Off" : loopMode === "repeat" ? "Loop" : "Next";

  return (
    <section aria-label="Audio player" className="fixed bottom-0 left-0 right-0 border-t border-[#ebd6ab] dark:border-[#423321] bg-[#fffcf5] dark:bg-[#1e1710]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-[0_-8px_24px_rgba(143,100,34,0.05)] z-40">
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onCanPlay={() => setIsLoading(false)}
          onPlay={() => {
            setAudioState("playing");
            if ("mediaSession" in navigator) {
              navigator.mediaSession.playbackState = "playing";
            }
          }}
          onPause={() => {
            const newState = (prev: typeof audioState) => prev === "unavailable" ? prev : "paused";
            setAudioState(newState);
            if ("mediaSession" in navigator) {
              navigator.mediaSession.playbackState = "paused";
            }
          }}
          onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setAudioDuration(e.currentTarget.duration)}
          onEnded={handleEnded}
          onError={() => { setAudioAvailable(false); setAudioState("unavailable"); setIsLoading(false); }}
        />

        <div className="flex items-center gap-3">
          <span className="w-10 text-right text-xs font-medium tabular-nums text-[#a88d63] dark:text-[#bda27e]">{formatTime(audioCurrentTime)}</span>
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
            <div className="absolute left-0 right-0 h-2 rounded-full bg-[#f4e9cb] dark:bg-[#2d2218] overflow-hidden">
              <div className="h-full bg-[#c0a986] transition-all duration-100 ease-linear" style={{ width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%` }} />
            </div>
          </div>
          <span className="w-10 text-xs font-medium tabular-nums text-[#a88d63] dark:text-[#bda27e]">{formatTime(audioDuration)}</span>
        </div>

        <div className="flex items-center justify-between px-1">
          {/* Loop mode + repeat count */}
          <div className="flex items-center gap-1">
            <button
              onClick={cycleLoopMode}
              aria-label={`Loop: ${loopLabel}`}
              className={`flex h-9 items-center gap-1 rounded-full px-2 transition-colors text-[11px] font-semibold ${loopMode !== "off" ? "bg-[#fcebc4] dark:bg-[#2d2218] text-[#8f6422] dark:text-[#d4aa61]" : "text-[#b0976e] dark:text-[#bda27e]"}`}
            >
              <Repeat className="h-4 w-4" />
              <span>{loopLabel}</span>
            </button>
            {loopMode !== "off" && (
              <button
                onClick={cycleRepeatCount}
                aria-label={`Repeat ${repeatLabel}`}
                className="flex h-9 items-center rounded-full bg-[#fcebc4] dark:bg-[#2d2218] px-2 text-[11px] font-bold text-[#8f6422] dark:text-[#d4aa61] tabular-nums"
              >
                {repeatLabel}
              </button>
            )}
          </div>

          {/* Transport controls */}
          <div className="flex items-center gap-3">
            <button onClick={onPrev} disabled={isFirst} aria-label="Previous shloka" className="flex h-10 w-10 items-center justify-center rounded-full text-[#5c431b] dark:text-[#f0e3ce] disabled:opacity-30">
              <SkipBack className="h-5 w-5 fill-current" />
            </button>
            <button onClick={togglePlayPause} disabled={!audioAvailable} className="flex h-14 w-14 items-center justify-center rounded-full bg-[#4a3615] dark:bg-[#d4aa61] dark:text-[#1e1710] text-[#fcebc4] shadow-[0_4px_12px_rgba(74,54,21,0.2)] disabled:opacity-50 transition-transform active:scale-95">
              {!audioAvailable ? <AlertCircle className="h-6 w-6 text-red-400" /> : isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : audioState === "playing" ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
            </button>
            <button onClick={() => { setPendingAutoPlay(true); onNext(); }} disabled={isLast} aria-label="Next shloka" className="flex h-10 w-10 items-center justify-center rounded-full text-[#5c431b] dark:text-[#f0e3ce] disabled:opacity-30">
              <SkipForward className="h-5 w-5 fill-current" />
            </button>
          </div>

          {/* Speed + Stop */}
          <div className="flex items-center gap-1">
            <button
              onClick={cycleSpeed}
              aria-label={`Speed ${playbackRate}x`}
              className={`flex h-9 items-center gap-1 rounded-full px-2 transition-colors text-[11px] font-semibold ${playbackRate !== 1 ? "bg-[#fcebc4] dark:bg-[#2d2218] text-[#8f6422] dark:text-[#d4aa61]" : "text-[#b0976e] dark:text-[#bda27e]"}`}
            >
              <Gauge className="h-4 w-4" />
              <span>{playbackRate}x</span>
            </button>
            <button onClick={stopAudio} disabled={audioState === "idle" || !audioAvailable} aria-label="Stop playback" className="flex h-9 w-9 items-center justify-center rounded-full text-[#b0976e] dark:text-[#bda27e] disabled:opacity-30">
              <Square className="h-4 w-4 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
