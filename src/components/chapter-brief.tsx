"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLearning } from "@/components/learning-provider";

type KeyVerse = { refs: { ref: string; id?: string }[]; note: string };
type Brief = { overview: string; quickRead: string[]; keyVerses: KeyVerse[]; actions: string[]; remember: string };
type ChapterBrief = { chapter: number; en: Brief; ta: Brief };
type Lang = "en" | "ta";

const LABELS: Record<Lang, { title: string; overview: string; quick: string; verses: string; actions: string; remember: string; star: string }> = {
  en: { title: "Chapter brief", overview: "Overview", quick: "Quick read", verses: "Key verses", actions: "Action points", remember: "Remember", star: "Tap a highlighted verse to learn it" },
  ta: { title: "அத்தியாயச் சுருக்கம்", overview: "சுருக்கம்", quick: "விரைவாகப் படிக்க", verses: "முக்கிய ஸ்லோகங்கள்", actions: "செயல் குறிப்புகள்", remember: "நினைவில் கொள்ள", star: "கற்க, குறிக்கப்பட்ட ஸ்லோகத்தைத் தட்டவும்" },
};

// ~95 KB of text: loaded only when a player is opened, then kept in memory.
let briefsPromise: Promise<ChapterBrief[]> | undefined;
const loadBriefs = () => (briefsPromise ??= import("@/data/chapter-briefs.json").then((m) => m.default as ChapterBrief[]));

/** Overview, quick read, key verses and action points for a chapter, shown under the full-screen player. */
export function ChapterBriefPanel({ chapter }: { chapter: number }) {
  const { learner } = useLearning();
  const router = useRouter();
  const [briefs, setBriefs] = useState<ChapterBrief[]>();
  const [lang, setLang] = useState<Lang>(learner.state.contentMode === "tamil" ? "ta" : "en");
  useEffect(() => { let live = true; loadBriefs().then((b) => live && setBriefs(b)).catch(() => {}); return () => { live = false; }; }, []);

  const brief = briefs?.find((b) => b.chapter === chapter)?.[lang];
  if (!brief) return null;
  const t = LABELS[lang];
  const open = (id: string) => { learner.goToShloka(id); router.push("/"); };

  return <section id="chapter-brief" className="chapter-brief" aria-labelledby="chapter-brief-title" lang={lang === "ta" ? "ta" : "en"}>
    <div className="chapter-brief-head">
      <h3 id="chapter-brief-title" className="font-serif">{t.title}</h3>
      <div className="chapter-brief-lang" role="group" aria-label="Language">
        {(["en", "ta"] as const).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>{l === "en" ? "English" : "தமிழ்"}</button>)}
      </div>
    </div>

    <p className="chapter-brief-overview">{brief.overview}</p>

    <h4 className="eyebrow">{t.quick}</h4>
    <ul className="chapter-brief-quick">{brief.quickRead.map((q) => <li key={q}>{q}</li>)}</ul>

    <h4 className="eyebrow">{t.verses}</h4>
    <ul className="chapter-brief-verses">
      {brief.keyVerses.map((v) => <li key={v.refs.map((r) => r.ref).join()}>
        <span className="chapter-brief-refs">{v.refs.map((r) => r.id
          ? <button key={r.ref} className="chapter-brief-ref" data-learn onClick={() => open(r.id!)} aria-label={`${r.ref}: open in learning`}>{r.ref}</button>
          : <span key={r.ref} className="chapter-brief-ref">{r.ref}</span>)}</span>
        <span className="study-muted">{v.note}</span>
      </li>)}
    </ul>
    {brief.keyVerses.some((v) => v.refs.some((r) => r.id)) && <p className="chapter-brief-hint study-muted">{t.star}</p>}

    <h4 className="eyebrow">{t.actions}</h4>
    <ol className="chapter-brief-actions">{brief.actions.map((a) => <li key={a}>{a}</li>)}</ol>

    <figure className="chapter-brief-remember">
      <figcaption className="eyebrow">{t.remember}</figcaption>
      <blockquote className="font-serif">{brief.remember}</blockquote>
    </figure>
  </section>;
}
