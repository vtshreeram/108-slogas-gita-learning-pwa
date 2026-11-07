"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { loadPurports, type Purport as PurportData } from "@/lib/gita-verses";

type Props = { chapter: number; reference: string; language: "en" | "ta" };

/** Collapsed "Read purport" row under a translation. Renders nothing when the verse has no purport yet. */
export function Purport({ chapter, reference, language }: Props) {
  const [data, setData] = useState<PurportData | undefined>();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(undefined); setOpen(false);
    loadPurports(chapter).then((all) => { if (!cancelled) setData(all[reference]); }).catch(() => {});
    return () => { cancelled = true; };
  }, [chapter, reference]);

  const paragraphs: { text: string; verified: boolean; corrected?: boolean }[] | undefined = language === "en" ? data?.en?.map((text) => ({ text, verified: true })) : data?.ta;
  if (!paragraphs?.length) return null;
  const label = language === "en" ? "Purport" : "பொருளுரை";
  const tamil = language === "ta";

  return (
    <div className="purport mt-6 w-full border-t border-[var(--study-border)] pt-3 text-left">
      <button
        onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`purport-${reference}`}
        className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--study-ink)]"
      >
        <span lang={tamil ? "ta" : "en"}>{tamil ? (open ? "பொருளுரையை மறைக்க" : "பொருளுரையைப் படிக்க") : (open ? "Hide purport" : "Read purport")}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={`purport-${reference}`} role="region" aria-label={label} lang={tamil ? "ta" : "en"}
          className={`mt-4 space-y-5 leading-[1.9] text-[var(--study-ink)] ${tamil ? "text-[17px] sm:text-[18px] tamil-text" : "text-lg"}`}>
          {paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}
          {paragraphs.some((p) => !p.verified) && (
            <p lang="en" className="rounded-lg bg-[#fcebc4]/60 px-3 py-2 text-[12px] leading-snug text-[#6b4a14] dark:bg-[#2d2218] dark:text-[#bda27e]">
              {paragraphs.every((p) => p.verified || p.corrected)
                ? "Machine-corrected from scanned text, not yet proofread by a person. It may still contain errors."
                : "Unproofread OCR from the scanned book. It may contain spelling errors."}
            </p>
          )}
          <p className="text-center text-[11px] text-[#8a6b3d] dark:text-[#bda27e]">
            {language === "en"
              ? <>Purport by A.C. Bhaktivedanta Swami Prabhupada © BBT · <a className="underline underline-offset-4" href={`https://vedabase.io/en/library/bg/${chapter}/${reference.split(".")[1]}/`} target="_blank" rel="noopener noreferrer">Vedabase</a></>
              : <span lang="ta">பகவத் கீதை உண்மையுருவில் — தமிழ் பதிப்பு © BBT</span>}
          </p>
        </div>
      )}
    </div>
  );
}
