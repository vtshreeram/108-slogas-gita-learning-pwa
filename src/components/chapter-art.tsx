import type { CSSProperties } from "react";

/** Parchment "cover" for a chapter; there is no album art, so the numeral carries the identity. */
export function ChapterArt({ chapter, className = "" }: { chapter: number; className?: string }) {
  return <div className={`chapter-art ${className}`} style={{ "--h": 30 + ((chapter * 7) % 26) } as CSSProperties} aria-hidden="true"><span className="chapter-art-om">ॐ</span><span className="chapter-art-no">{chapter}</span></div>;
}
