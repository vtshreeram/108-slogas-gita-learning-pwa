import { useState, useRef, useEffect } from "react";
import { AlertCircle, Lightbulb, Eye } from "lucide-react";
import { CONTENT_TABS, LOOP_STEPS, STEP_CONFIG, fullDone, StepProgress } from "@/lib/constants";
import { Shloka } from "@/lib/shlokas";

type ShlokaCardProps = {
  active: Shloka;
  activeGlobalIndex: number;
  isMastered: boolean;
  contentMode: "transliteration" | "english" | "sanskrit";
  setContentMode: (m: "transliteration" | "english" | "sanskrit") => void;
  audioAvailable: boolean;
  activeProgress: StepProgress;
  onMarkStep: (id: string, step: any) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

export function ShlokaCard({
  active, activeGlobalIndex, isMastered,
  contentMode, setContentMode, audioAvailable,
  activeProgress, onMarkStep, onSwipeLeft, onSwipeRight
}: ShlokaCardProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

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
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a88d63] dark:text-[#bda27e]">Ch {active.chapter} • Shloka {active.verse}</span>
        <span className="text-xs font-medium text-[#c0a986] dark:text-[#bda27e]">#{activeGlobalIndex}</span>
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
                <p className="text-[22px] sm:text-[26px] leading-[1.8] font-medium text-[#4a3615] dark:text-[#f0e3ce] break-words hyphens-auto">{active.transliteration}</p>
              )}
              {contentMode === "english" && (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#fcf5e3] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321] text-[#8f6422] dark:text-[#d4aa61] mb-1">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <p className="text-lg sm:text-xl leading-relaxed text-[#5c431b] dark:text-[#f0e3ce] font-medium">{active.english}</p>
                </div>
              )}
              {contentMode === "sanskrit" && (
                <p className="text-[26px] sm:text-[32px] leading-[1.8] font-[family-name:var(--font-noto-sans-devanagari)] font-bold text-[#3d2c10] dark:text-[#f0e3ce] break-words hyphens-auto" lang="sa">{active.sanskrit}</p>
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
