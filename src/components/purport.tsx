"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { loadPurports, type Purport as PurportData } from "@/lib/gita-verses";
import { hasPurport } from "@/lib/verse-index";

type Props = { chapter: number; reference: string; language: "en" | "ta" };

/** Collapsed "Read purport" row under a translation. Renders nothing when the verse has no purport; the text downloads only when opened. Mount with `key={reference}`. */
export function Purport({ chapter, reference, language }: Props) {
  const [data, setData] = useState<PurportData | undefined>();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [attempt, setAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const available = hasPurport(reference, language);

  // The parent keys this component by verse, so every verse starts collapsed and empty and can never show
  // another verse's text. Nothing is fetched until the learner opens it.
  useEffect(() => {
    if (!open || !available) return;
    // The chapter file is shared by English and Tamil and cached for the session, so this is one request per chapter.
    const controller = new AbortController();
    setStatus("loading");
    loadPurports(chapter, controller.signal)
      .then((all) => { setData(all[reference]); setStatus("done"); })
      .catch((error) => { if (controller.signal.aborted) return; setErrorMessage(error instanceof Error ? error.message : "Could not load the purport."); setStatus("error"); });
    return () => controller.abort(); // leaving this verse never lets its response land on another one
  }, [open, available, chapter, reference, attempt]);

  if (!available) return null;
  const paragraphs: { text: string; verified: boolean; corrected?: boolean }[] | undefined = language === "en" ? data?.en?.map((text) => ({ text, verified: true })) : data?.ta;
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
          {status === "loading" && <p role="status" lang="en" className="study-muted text-sm">Loading…</p>}
          {status === "error" && <p role="alert" lang="en" className="study-muted text-sm">{errorMessage} <button className="underline underline-offset-4" onClick={() => setAttempt((n) => n + 1)}>Try again</button></p>}
          {status === "done" && !paragraphs?.length && <p lang="en" className="study-muted text-sm">This purport is not available yet.</p>}
          {paragraphs?.map((p, i) => <p key={i}>{p.text}</p>)}
          {paragraphs?.length ? <>
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
          </> : null}
        </div>
      )}
    </div>
  );
}
