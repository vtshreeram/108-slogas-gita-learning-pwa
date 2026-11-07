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
    <div className="mt-4 w-full border-t border-[#f4e9cb] pt-3 text-left dark:border-[#423321]">
      <button
        onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`purport-${reference}`}
        className="mx-auto flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-bold uppercase tracking-wider text-[#6b4a14] hover:opacity-80 dark:text-[#d4aa61]"
      >
        <span lang={tamil ? "ta" : "en"}>{open ? `Hide ${label}` : `Read ${label}`}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={`purport-${reference}`} role="region" aria-label={label} tabIndex={0} lang={tamil ? "ta" : "en"}
          className={`mt-2 max-h-[420px] space-y-3 overflow-y-auto pr-2 leading-[1.8] text-[#4a3615] dark:text-[#f0e3ce] custom-scrollbar ${tamil ? "text-[17px] sm:text-[18px] font-[family-name:var(--font-noto-sans-tamil)]" : "text-[18px] sm:text-[20px] font-medium"}`}>
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
