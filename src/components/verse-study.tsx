import { Shloka, ENGLISH_TRANSLATION_SOURCE } from "@/lib/shlokas";
import { tamilChant } from "@/lib/tamil-chant";

export function VerseStudy({ shloka }: { shloka: Shloka }) {
  const source = `${ENGLISH_TRANSLATION_SOURCE}${shloka.chapter}/${shloka.reference.split(".")[1]}/`;
  return <details className="study-panel">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-sm">Pronunciation & word meanings</summary>
    <h3 className="mt-3 text-sm font-semibold">Chant in Tamil · தமிழ் உச்சரிப்பு</h3>
    <p lang="ta" className="my-3 whitespace-pre-line text-lg leading-loose font-[family-name:var(--font-noto-sans-tamil)]">{tamilChant(shloka.transliteration)}</p>
    <p className="study-muted text-xs leading-relaxed">Pronunciation aid generated from the Roman text. Superscripts preserve Sanskrit consonant differences: க / க² / க³ / க⁴ = ka / kha / ga / gha; likewise for ட, த and ப. Follow the recording for pronunciation.</p>
    <h3 className="mt-4 text-sm font-semibold">Word-by-word meanings</h3>
    <p className="my-2 text-sm">Read each Sanskrit word and its meaning in the source edition.</p>
    <a className="study-button inline-flex" href={source} target="_blank" rel="noopener noreferrer">Open word meanings · online ↗</a>
    <p className="study-muted mt-3 text-xs">English: Prabhupada. Tamil meaning: edited Bharathiyar. Independent Sanskrit/Tamil review is pending.</p>
  </details>;
}
