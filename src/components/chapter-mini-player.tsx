"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pause, Play, SkipForward, X } from "lucide-react";
import { useChapterAudio } from "@/components/chapter-audio-provider";
import { ChapterArt } from "@/components/chapter-art";
import { formatTime } from "@/lib/audio-playback";

/** "Now playing" bar: on the chapter list always, elsewhere once a chapter was started, stacked above the verse player. */
export function ChapterMiniPlayer() {
  const { chapter, next, playing, loading, error, position, duration, ready, engaged, view, setView, toggle, choose, dismiss } = useChapterAudio();
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLElement | null>(null);
  const onChapters = pathname === "/chapters";
  const visible = ready && !!chapter && (onChapters ? view === "list" : engaged);

  useEffect(() => {
    const bar = ref.current;
    const root = document.documentElement;
    if (!visible || !bar) { root.style.removeProperty("--chapter-mini-height"); return; }
    const measure = () => root.style.setProperty("--chapter-mini-height", `${bar.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => { observer.disconnect(); root.style.removeProperty("--chapter-mini-height"); };
  }, [visible]);

  if (!visible || !chapter) return null;
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  const open = () => { setView("player"); if (!onChapters) router.push("/chapters"); };
  return <section ref={ref} className="chapter-mini" aria-label="Now playing">
    <button className="chapter-mini-open" onClick={open}>
      <ChapterArt chapter={chapter.chapter} className="chapter-art-small" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold"><span className="sr-only">Chapter {chapter.chapter}: </span>{chapter.title}<span className="sr-only"> (open player)</span></span>
        <span className="study-muted block truncate text-xs tabular-nums"><span aria-hidden="true">Chapter {chapter.chapter} · </span>{error ? "Could not play. Tap to retry." : `${formatTime(position)} / ${formatTime(duration)}`}</span>
      </span>
    </button>
    <button className="player-play" aria-label={error ? "Retry chapter audio" : loading ? "Cancel loading chapter" : playing ? "Pause chapter audio" : "Play chapter audio"} onClick={toggle}>
      {error ? <AlertCircle className="h-5 w-5" /> : loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
    </button>
    {onChapters
      ? <button className="icon-button" aria-label="Next chapter" disabled={!next} onClick={() => choose(next, playing || loading)}><SkipForward className="h-5 w-5" /></button>
      : <button className="icon-button" aria-label="Stop chapter audio" onClick={dismiss}><X className="h-5 w-5" /></button>}
    <span className="chapter-mini-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
  </section>;
}
