import { useState, useRef, useEffect, useMemo } from "react";
import { AlertCircle, Eye, ChevronDown } from "lucide-react";
import { CONTENT_TABS, LOOP_STEPS, STEP_CONFIG, fullDone, StepProgress } from "@/lib/constants";
import { Shloka, SHLOKAS } from "@/lib/shlokas";

type ShlokaCardProps = {
  active: Shloka;
  activeGlobalIndex: number;
  isMastered: boolean;
  contentMode: "transliteration" | "english" | "tamil";
  setContentMode: (m: "transliteration" | "english" | "tamil") => void;
  audioAvailable: boolean;
  activeProgress: StepProgress;
  onMarkStep: (id: string, step: import("@/lib/constants").LoopStep) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onJumpTo: (index: number) => void;
};

export function ShlokaCard({
  active, activeGlobalIndex, isMastered,
  contentMode, setContentMode, audioAvailable,
  activeProgress, onMarkStep, onSwipeLeft, onSwipeRight, onJumpTo
}: ShlokaCardProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const chapters = useMemo(() => {
    const map = new Map<number, { verse: number; index: number }[]>();
    SHLOKAS.forEach((s, i) => {
      if (!map.has(s.chapter)) map.set(s.chapter, []);
      map.get(s.chapter)!.push({ verse: s.verse, index: i });
    });
    return map;
  }, []);

  useEffect(() => {
    setIsRevealed(false);
  }, [active.id]);

  const isHidden = activeProgress.listen && activeProgress.repeat && activeProgress.understand && !activeProgress.recall && !isRevealed;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) onSwipeLeft();
      else if (deltaX > 0) onSwipeRight();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <article
      className="flex flex-col rounded-3xl bg-white dark:bg-[#1e1710] shadow-[0_4px_16px_rgba(143,100,34,0.1)] border border-[#f0d498] dark:border-[#423321] p-4 sm:p-6 min-h-[400px]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between mb-4 relative">
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#a88d63] dark:text-[#bda27e] hover:text-[#8f6422] dark:hover:text-[#d4aa61] transition-colors"
        >
          Ch {active.chapter} • Shloka {active.verse}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
        </button>
        <span className="text-xs font-medium text-[#c0a986] dark:text-[#bda27e]">#{activeGlobalIndex}</span>

        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
            <div className="absolute top-full left-0 mt-2 z-40 w-72 max-h-80 overflow-y-auto rounded-2xl bg-white dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] shadow-xl p-3">
              {[...chapters.entries()].map(([ch, verses]) => (
                <div key={ch} className="mb-3 last:mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#a88d63] dark:text-[#bda27e] mb-1.5 border-b border-[#f4e9cb] dark:border-[#423321] pb-1">Chapter {ch}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {verses.map((v) => (
                      <button
                        key={v.index}
                        onClick={() => { onJumpTo(v.index); setPickerOpen(false); }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${v.index === activeGlobalIndex - 1 ? "bg-[#8f6422] text-white dark:bg-[#d4aa61] dark:text-[#1e1710]" : "bg-[#fcebc4] dark:bg-[#2d2218] text-[#8f6422] dark:text-[#d4aa61] hover:bg-[#ebd6ab] dark:hover:bg-[#423321]"}`}
                      >
                        {ch}.{v.verse}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex bg-[#f9f1e1] dark:bg-[#2d2218] rounded-full p-1 mb-4 border border-[#ebd6ab] dark:border-[#423321]">
        {CONTENT_TABS.map((tab) => (
          <button
            key={tab.mode}
            onClick={() => setContentMode(tab.mode)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors ${contentMode === tab.mode ? "bg-white dark:bg-[#1e1710] text-[#5c431b] dark:text-[#f0e3ce] shadow-sm border border-[#e2cca4] dark:border-[#423321]" : "text-[#b0976e] dark:text-[#bda27e]"}`}
          >{tab.label}</button>
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center py-6">
        <div className="text-center w-full">
          {isHidden && contentMode !== "english" ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-[#8a6b3d] dark:text-[#bda27e] text-sm font-medium">Try to recall the shloka from memory</p>
              <button
                onClick={() => setIsRevealed(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#f4e9cb] dark:bg-[#2d2218] rounded-full text-[#5c431b] dark:text-[#f0e3ce] font-semibold text-sm border border-[#ebd6ab] dark:border-[#423321] shadow-sm"
              >
                <Eye className="w-4 h-4" />
                Reveal text
              </button>
            </div>
          ) : (
            <>
              {contentMode === "transliteration" && (
                <p className="whitespace-pre-wrap text-[22px] sm:text-[26px] leading-[1.8] font-medium text-[#4a3615] dark:text-[#f0e3ce] break-words hyphens-auto">{active.transliteration}</p>
              )}
              {contentMode === "english" && (
                <p className="text-lg sm:text-xl leading-relaxed text-[#5c431b] dark:text-[#f0e3ce] font-medium">{active.english}</p>
              )}
              {contentMode === "tamil" && (
                <p className="whitespace-pre-wrap text-[26px] sm:text-[32px] leading-[1.8] font-[family-name:var(--font-noto-sans-tamil)] font-bold text-[#3d2c10] dark:text-[#f0e3ce] break-words hyphens-auto" lang="ta">{active.tamil}</p>
              )}
            </>
          )}
        </div>
      </div>

      {!audioAvailable && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#fffcf5] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] p-3 text-sm text-[#8f6422] dark:text-[#d4aa61]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>Audio currently unavailable</p>
        </div>
      )}

      {/* Progress Pills */}
      <div className="grid grid-cols-4 gap-2 mt-auto pt-4 border-t border-[#f4e9cb]">
        {LOOP_STEPS.map((step) => {
          const { Icon, label } = STEP_CONFIG[step];
          const isDone = activeProgress[step];
          const isUnlocked = step === "listen" || activeProgress[LOOP_STEPS[LOOP_STEPS.indexOf(step) - 1]];
          return (
            <button
              key={step}
              onClick={() => {
                if (isUnlocked) {
                  if (step === "recall" && isHidden) {
                    setIsRevealed(true);
                  } else {
                    onMarkStep(active.id, step);
                  }
                }
              }}
              disabled={!isUnlocked}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${isDone ? "bg-[#e8f5df] dark:bg-[#142610] border-[#c1e0b0] dark:border-[#284f1d] text-[#2c5d1f] dark:text-[#88c775]" : isUnlocked ? "bg-white dark:bg-[#1e1710] border-[#e2cca4] dark:border-[#423321] text-[#8a6b3d] dark:text-[#bda27e] hover:bg-[#fcf5e3] dark:bg-[#2d2218]" : "bg-[#f4e9cb] dark:bg-[#2d2218]/50 border-transparent text-[#c0a986] dark:text-[#bda27e] opacity-50 cursor-not-allowed"}`}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
