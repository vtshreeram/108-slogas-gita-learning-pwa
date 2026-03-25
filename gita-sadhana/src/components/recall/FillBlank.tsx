import { useState, useMemo } from 'react'
import type { Shloka } from '../../types'

interface FillBlankProps {
  shloka: Shloka
  onResult: (correct: boolean) => void
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zāīūṛṝḷḹṃḥśṣṭḍṇñṅ]/g, '').trim()
}

export default function FillBlank({ shloka, onResult }: FillBlankProps) {
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)

  const words = useMemo(() => {
    return shloka.transliteration.split(/\s+/).filter(Boolean)
  }, [shloka.id])

  // Pick a random word from the middle of the transliteration to blank out
  const blankIdx = useMemo(() => {
    const mid = Math.floor(words.length / 3)
    return mid + Math.floor(Math.random() * Math.floor(words.length / 3))
  }, [shloka.id])

  const answer = words[blankIdx] || ''

  const handleSubmit = () => {
    if (submitted) return
    const isCorrect = normalize(input) === normalize(answer)
    setCorrect(isCorrect)
    setSubmitted(true)
    setTimeout(() => onResult(isCorrect), 1200)
  }

  const displayWords = words.map((w, i) =>
    i === blankIdx ? '______' : w
  )

  return (
    <div className="space-y-5">
      <div>
        <p className="section-label mb-3">Fill in the blank</p>
        <p className="text-text-secondary text-sm italic leading-relaxed text-center bg-elevated rounded-xl p-4">
          {displayWords.join(' ')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Type the missing word..."
          disabled={submitted}
          className="w-full bg-elevated text-text-primary rounded-xl px-4 py-3 text-sm outline-none border border-elevated focus:border-gold transition-colors placeholder:text-text-muted"
          autoFocus
        />

        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="btn-primary w-full disabled:opacity-40"
          >
            Check
          </button>
        ) : (
          <div className={`rounded-xl p-4 text-center ${correct ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
            <p className={`font-semibold ${correct ? 'text-green-300' : 'text-red-300'}`}>
              {correct ? '✓ Correct!' : '✗ Not quite'}
            </p>
            {!correct && (
              <p className="text-text-secondary text-sm mt-1">
                Answer: <span className="text-text-primary font-medium">{answer}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
