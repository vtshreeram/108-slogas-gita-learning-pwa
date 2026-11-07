/**
 * ShlokaCard - Main content display component
 *
 * Color tokens (defined in globals.css):
 * - --gita-light-* : Light backgrounds & accents (cream, off-white, sand, gold)
 * - --gita-brown-* : Mid-tone browns, text colors, and warm accents
 * - --gita-dark-* : Dark backgrounds for dark mode
 * - --gita-success-* : Green colors for completed/progress states
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { AlertCircle, Eye, ChevronDown, Star } from "lucide-react";
import { CONTENT_TABS, LOOP_STEPS, STEP_CONFIG, SWIPE_THRESHOLD_PX, StepProgress } from "@/lib/constants";
import { Shloka, SHLOKAS, tamilCredit, ENGLISH_TRANSLATION_SOURCE } from "@/lib/shlokas";
import type { GitaVerse } from "@/lib/gita-verses";
import { Purport } from "@/components/purport";
import { filterVerses, parseReference } from "@/lib/verse-search";

type ShlokaCardProps = {
  active: Shloka;
  activeGlobalIndex: number;
  isMastered: boolean;
  contentMode: "transliteration" | "english" | "tamil";
  setContentMode: (m: "transliteration" | "english" | "tamil") => void;
  audioAvailable: boolean;
  activeProgress: StepProgress;
  onMarkStep: (id: string, step: import("@/lib/constants").LoopStep) => void;
  onRecallMissed: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onJumpTo: (index: number) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  /** Every verse of the Gita (null while loading). The picker lists these; the 108 are tinted. */
  allVerses: GitaVerse[] | null;
  /** A verse outside the 108 shown read-only in place of the learning card content. */
  browse: GitaVerse | null;
  onBrowse: (verse: GitaVerse | null) => void;
};

const SHLOKA_INDEX = new Map(SHLOKAS.map((s, i) => [s.id, i]));

export function ShlokaCard({
  active, activeGlobalIndex,
  contentMode, setContentMode, audioAvailable,
  activeProgress, onMarkStep, onRecallMissed, onSwipeLeft, onSwipeRight, onJumpTo,
  isFavorite, onToggleFavorite, allVerses, browse, onBrowse
}: ShlokaCardProps) {
  const current: Shloka = browse ?? active;
  const [goTo, setGoTo] = useState("");
  const [goToError, setGoToError] = useState("");
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const chapters = useMemo(() => {
    const source: GitaVerse[] = allVerses ?? SHLOKAS.map((v) => ({ ...v, important: true }));
    const map = new Map<number, GitaVerse[]>();
    for (const v of source) {
      if (!map.has(v.chapter)) map.set(v.chapter, []);
      map.get(v.chapter)!.push(v);
    }
    return map;
  }, [allVerses]);

  const pick = (v: GitaVerse) => {
    const index = SHLOKA_INDEX.get(v.id);
    if (v.important && index !== undefined) { onBrowse(null); onJumpTo(index); } else onBrowse(v);
    setPickerOpen(false);
  };

  const submitGoTo = (event: React.FormEvent) => {
    event.preventDefault();
    const found = allVerses && parseReference(goTo) ? filterVerses(allVerses, { text: goTo, filter: "all", chapter: null })[0] : undefined;
    if (!found) { setGoToError(allVerses ? "Try a reference like 2.47" : "Still loading all verses…"); return; }
    setGoToError(""); setGoTo(""); pick(found);
  };

  useEffect(() => {
    setIsRevealed(false);
  }, [active.id, browse?.id]);

  const isHidden = !browse && activeProgress.listen && activeProgress.repeat && activeProgress.understand && !activeProgress.recall && !isRevealed;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
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
      onKeyDown={(event) => { if (event.key === "Escape") setPickerOpen(false); }}
    >
      <div className="flex items-center justify-between mb-4 relative">
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          aria-expanded={pickerOpen}
          aria-controls="verse-picker"
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#705735] dark:text-[#bda27e] hover:text-[#8f6422] dark:hover:text-[#d4aa61] transition-colors"
        >
          Ch {current.chapter} • Shloka {current.verse}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
        </button>
        <div className="flex items-center gap-2">
          {browse ? (
            <span className="rounded-full border border-[#ebd6ab] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#705735] dark:border-[#423321] dark:text-[#bda27e]">Read only</span>
          ) : (<>
          <button
            onClick={onToggleFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className="flex h-11 w-11 items-center justify-center rounded transition-colors hover:opacity-80"
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                isFavorite
                  ? "fill-[#d4aa61] text-[#d4aa61]"
                  : "text-[#705735] dark:text-[#bda27e]"
              }`}
            />
          </button>
          <span className="text-xs font-medium text-[#705735] dark:text-[#bda27e]">#{activeGlobalIndex}</span>
          </>)}
        </div>

        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
            <div id="verse-picker" role="region" aria-label="Choose a verse" tabIndex={0} className="absolute top-full left-0 mt-2 z-40 w-[min(18rem,calc(100vw-4rem))] max-h-80 overflow-y-auto rounded-2xl bg-white dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] shadow-xl p-3">
              <form onSubmit={submitGoTo} className="mb-2">
                <label className="sr-only" htmlFor="verse-goto">Go to verse</label>
                <input id="verse-goto" value={goTo} onChange={(e) => { setGoTo(e.target.value); setGoToError(""); }} inputMode="decimal" placeholder="Go to… 2.47"
                  className="min-h-9 w-full rounded-lg border border-[#ebd6ab] bg-white px-3 text-base text-[#4a3615] dark:border-[#423321] dark:bg-[#15100a] dark:text-[#f0e3ce]" />
                {goToError && <p role="status" className="mt-1 text-[11px] text-[#8f6422] dark:text-[#d4aa61]">{goToError}</p>}
              </form>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] text-[#705735] dark:text-[#bda27e]">
                <span className="inline-block h-3 w-3 rounded bg-[#fcebc4] ring-1 ring-[#d4aa61] dark:bg-[#3a2c14]" aria-hidden /> the 108 you learn
                {!allVerses && <span className="ml-auto">Loading all verses…</span>}
              </p>
              {[...chapters.entries()].map(([ch, verses]) => (
                <div key={ch} className="mb-3 last:mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#705735] dark:text-[#bda27e] mb-1.5 border-b border-[#f4e9cb] dark:border-[#423321] pb-1">Chapter {ch}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {verses.map((v) => {
                      const isActive = browse ? browse.id === v.id : v.id === active.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => pick(v)}
                          aria-current={isActive ? "true" : undefined}
                          aria-label={v.important ? `${v.reference}, one of the 108` : v.reference}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${isActive ? "bg-[#8f6422] text-white dark:bg-[#d4aa61] dark:text-[#1e1710]" : v.important ? "bg-[#fcebc4] text-[#5c431b] ring-1 ring-[#d4aa61] dark:bg-[#3a2c14] dark:text-[#f0e3ce]" : "border border-[#ebd6ab] text-[#705735] dark:border-[#423321] dark:text-[#bda27e]"}`}
                        >
                          {v.reference}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex bg-[#f9f1e1] dark:bg-[#2d2218] rounded-full p-1 mb-4 border border-[#ebd6ab] dark:border-[#423321]">
        {/* Content mode tabs: Roman transliteration, English translation, Tamil translation */}
        {CONTENT_TABS.map((tab) => (
          <button
            key={tab.mode}
            aria-pressed={contentMode === tab.mode}
            onClick={() => setContentMode(tab.mode)}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors ${contentMode === tab.mode ? "bg-white dark:bg-[#1e1710] text-[#5c431b] dark:text-[#f0e3ce] shadow-sm border border-[#e2cca4] dark:border-[#423321]" : "text-[#705735] dark:text-[#bda27e]"}`}
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
                <p className="whitespace-pre-wrap text-center text-[18px] sm:text-[20px] leading-[1.8] font-medium text-[#4a3615] dark:text-[#f0e3ce] break-words hyphens-auto">
                  {current.transliteration}
                </p>
              )}
              {contentMode === "english" && (
                <div lang="en">
                  <p className="text-[18px] sm:text-[20px] leading-[1.8] text-[#5c431b] dark:text-[#f0e3ce] font-medium">{current.english}</p>
                  <a href={`${ENGLISH_TRANSLATION_SOURCE}${current.chapter}/${current.reference.split(".")[1]}/`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs text-[#8a6b3d] dark:text-[#bda27e] underline underline-offset-4">
                    {current.translationAuthor} · Source
                  </a>
                  <Purport chapter={current.chapter} reference={current.reference} language="en" />
                </div>
              )}
              {contentMode === "tamil" && (
                <>
                <div role="region" aria-label="Tamil meaning" tabIndex={0} className="overflow-y-auto max-h-[350px] w-full pr-2 text-left custom-scrollbar">
                  <p className="whitespace-pre-wrap text-[17px] sm:text-[18px] leading-[1.8] font-[family-name:var(--font-noto-sans-tamil)] font-bold text-[#3d2c10] dark:text-[#f0e3ce] break-words hyphens-auto text-center" lang="ta">{current.tamil}</p>
                  {(() => {
                    const credit = tamilCredit(current);
                    const cls = "mt-4 block text-center text-xs text-[#8a6b3d] dark:text-[#bda27e]";
                    return credit.href
                      ? <a href={credit.href} target="_blank" rel="noopener noreferrer" lang="ta" className={`${cls} underline underline-offset-4`}>{credit.label} · மூலம்</a>
                      : <p lang="ta" className={cls}>{credit.label}</p>;
                  })()}
                </div>
                <Purport chapter={current.chapter} reference={current.reference} language="ta" />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {!browse && !audioAvailable && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#fffcf5] dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] p-3 text-sm text-[#8f6422] dark:text-[#d4aa61]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>Audio currently unavailable</p>
        </div>
      )}

      {browse && (
        <div className="mt-auto flex flex-col items-center gap-2 border-t border-[#f4e9cb] pt-4 dark:border-[#423321]">
          <p className="text-center text-xs text-[#705735] dark:text-[#bda27e]">Not one of your 108. Read it here; swipe or use the arrow keys to move through all 657.</p>
          <button onClick={() => onBrowse(null)} className="rounded-full bg-[#8f6422] px-4 py-2 text-xs font-semibold text-white dark:bg-[#d4aa61] dark:text-[#1e1710]">Back to my 108</button>
        </div>
      )}

      {/* Progress Pills */}
      {!browse && <div className="grid grid-cols-4 gap-2 mt-auto pt-4 border-t border-[#f4e9cb]">
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
              aria-label={`${label} step: ${isDone ? "completed" : isUnlocked ? "not completed" : "locked"}`}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${isDone ? "bg-[#e8f5df] dark:bg-[#142610] border-[#c1e0b0] dark:border-[#284f1d] text-[#2c5d1f] dark:text-[#88c775]" : isUnlocked ? "bg-white dark:bg-[#1e1710] border-[#e2cca4] dark:border-[#423321] text-[#8a6b3d] dark:text-[#bda27e] hover:bg-[#fcf5e3] dark:bg-[#2d2218]" : "bg-[#f4e9cb] dark:bg-[#2d2218]/50 border-transparent text-[#705735] dark:text-[#bda27e] opacity-50 cursor-not-allowed"}`}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>}

      {!browse && activeProgress.understand && !activeProgress.recall && !isHidden && (
        <button
          onClick={() => { onRecallMissed(); setIsRevealed(false); }}
          className="mt-2 self-center rounded-full px-3 py-1 text-[11px] font-semibold text-[#705735] dark:text-[#bda27e] underline underline-offset-4 hover:text-[#8f6422] dark:hover:text-[#d4aa61]"
        >
          Missed it? Try again
        </button>
      )}
    </article>
  );
}
