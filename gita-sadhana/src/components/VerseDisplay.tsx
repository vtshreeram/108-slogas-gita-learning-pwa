import { useState } from 'react'
import type { Shloka } from '../types'
import { useAppStore } from '../store/useAppStore'

interface VerseDisplayProps {
  shloka: Shloka
  showSynonyms?: boolean
  showTranslation?: boolean
  showTransliteration?: boolean
}

export default function VerseDisplay({
  shloka,
  showSynonyms = false,
  showTranslation = false,
  showTransliteration: showTransliterationProp,
}: VerseDisplayProps) {
  const { settings } = useAppStore()
  const showTranslit = showTransliterationProp ?? settings.showTransliteration
  const [activeWord, setActiveWord] = useState<number | null>(null)
  const [selectedTranslator, setSelectedTranslator] = useState(settings.preferredTranslator)

  const lines = shloka.sanskrit.split('\n').filter(Boolean)
  const translitLines = shloka.transliteration.split('\n').filter(Boolean)

  const englishTranslations = shloka.translations.filter(t => t.language === 'en')
  const currentTranslation = englishTranslations.find(t => t.authorId === selectedTranslator)
    ?? englishTranslations[0]

  return (
    <div className="space-y-6">
      {/* Chapter / Verse badge */}
      <div className="flex items-center gap-2">
        <span className="section-label">BG {shloka.verseRange}</span>
        <span className="text-text-muted text-xs">·</span>
        <span className="text-text-muted text-xs">{shloka.thematicTag}</span>
      </div>

      {/* Sanskrit text */}
      <div className="text-center space-y-1">
        {lines.map((line, i) => (
          <p
            key={i}
            className="font-devanagari text-2xl leading-loose text-text-primary"
          >
            {line}
          </p>
        ))}
      </div>

      {/* Transliteration */}
      {showTranslit && (
        <div className="text-center space-y-0.5 border-t border-elevated pt-4">
          {translitLines.map((line, i) => (
            <p key={i} className="text-text-secondary text-sm italic leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Synonyms */}
      {showSynonyms && shloka.wordMeanings.length > 0 && (
        <div className="border-t border-elevated pt-4 space-y-2">
          <p className="section-label">Synonyms</p>
          <div className="flex flex-wrap gap-x-1 gap-y-1 text-sm leading-relaxed">
            {shloka.wordMeanings.map((wm, i) => (
              <span key={i}>
                <button
                  onClick={() => setActiveWord(activeWord === i ? null : i)}
                  className={`font-medium transition-colors ${
                    activeWord === i ? 'text-gold' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {wm.word}
                </button>
                {activeWord === i && (
                  <span className="text-text-muted ml-1">— {wm.meaning}</span>
                )}
                {activeWord !== i && i < shloka.wordMeanings.length - 1 && (
                  <span className="text-text-muted">; </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Translation */}
      {showTranslation && currentTranslation && (
        <div className="border-t border-elevated pt-4 space-y-3">
          <p className="section-label">Translation</p>
          <p className="text-text-primary font-semibold text-base leading-relaxed">
            {currentTranslation.text}
          </p>

          {/* Translator selector */}
          {englishTranslations.length > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-text-muted text-xs">Translator:</span>
              <select
                value={selectedTranslator}
                onChange={e => setSelectedTranslator(e.target.value)}
                className="bg-elevated text-text-secondary text-xs rounded-lg px-2 py-1 border-none outline-none"
              >
                {englishTranslations.map(t => (
                  <option key={t.authorId} value={t.authorId}>
                    {t.authorName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
