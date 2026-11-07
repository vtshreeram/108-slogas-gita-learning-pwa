"use client";

import { Star, ArrowLeft, ArrowRight } from "lucide-react";
import { CONTENT_TABS, type AppState } from "@/lib/constants";
import { tamilCredit, ENGLISH_TRANSLATION_SOURCE } from "@/lib/shlokas";
import type { GitaVerse } from "@/lib/gita-verses";
import { Purport } from "@/components/purport";

type Props = {
  verse: GitaVerse;
  contentMode: AppState["contentMode"];
  setContentMode: (mode: AppState["contentMode"]) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
};

/** The reader stays in document flow, without touch interception or nested scrolling. */
export function ShlokaCard({ verse, contentMode, setContentMode, isFavorite, onToggleFavorite, isFirst, isLast, onNext, onPrev }: Props) {
  const credit = tamilCredit(verse);
  return <article className="verse-reader" aria-labelledby="verse-heading">
    <div className="verse-card-heading">
      <div className="verse-reference"><p>Chapter {verse.chapter}</p><span aria-hidden="true">·</span><h2 id="verse-heading">Sloka {verse.reference.split(".")[1]}</h2></div>
      {verse.important && <button className="icon-button favorite-button" aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={isFavorite} onClick={onToggleFavorite}><Star className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} aria-hidden="true" /></button>}
    </div>
    <div className="content-tabs" role="group" aria-label="Verse language">
      {CONTENT_TABS.map((tab) => <button key={tab.mode} aria-label={tab.label} aria-pressed={contentMode === tab.mode} onClick={() => setContentMode(tab.mode)} lang={tab.mode === "tamil" ? "ta" : "en"}>{tab.label}</button>)}
    </div>
    <div className="verse-body" key={`${verse.id}-${contentMode}`}>
      {contentMode === "transliteration" && <p className="chant-text" lang="sa-Latn">{verse.transliteration}</p>}
      {contentMode === "english" && <div lang="en"><p className="meaning-text">{verse.english}</p><a className="source-credit" href={`${ENGLISH_TRANSLATION_SOURCE}${verse.chapter}/${verse.reference.split(".")[1]}/`} target="_blank" rel="noopener noreferrer">{verse.translationAuthor} · Source ↗</a></div>}
      {contentMode === "tamil" && <div lang="ta" className="tamil-text"><p className="meaning-text">{verse.tamil}</p>{credit.href ? <a className="source-credit" href={credit.href} target="_blank" rel="noopener noreferrer">{credit.label} · மூலம் ↗</a> : <p className="source-credit">{credit.label}</p>}</div>}
      {contentMode !== "transliteration" && <Purport chapter={verse.chapter} reference={verse.reference} language={contentMode === "tamil" ? "ta" : "en"} />}
    </div>
    <nav className="verse-navigation" aria-label="Verse navigation">
      <button className="study-button" disabled={isFirst} onClick={onPrev}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
      <button className="study-button" disabled={isLast} onClick={onNext}>Next<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
    </nav>
  </article>;
}
