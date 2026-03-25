import { useState, useMemo } from 'react'
import type { Shloka } from '../../types'

interface MCQProps {
  shloka: Shloka
  allShlokas: Shloka[]
  onResult: (correct: boolean) => void
}

export default function MCQ({ shloka, allShlokas, onResult }: MCQProps) {
  const [selected, setSelected] = useState<number | null>(null)

  const lines = shloka.sanskrit.split('\n').filter(Boolean)
  const questionLine = lines[0]
  const correctAnswer = lines.slice(1).join('\n') || lines[0]

  // Build 3 wrong options from other shlokas
  const options = useMemo(() => {
    const others = allShlokas
      .filter(s => s.id !== shloka.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(s => s.sanskrit.split('\n').filter(Boolean).slice(1).join('\n') || s.sanskrit.split('\n')[0])

    const all = [
      { text: correctAnswer, correct: true },
      ...others.map(t => ({ text: t, correct: false })),
    ].sort(() => Math.random() - 0.5)

    return all
  }, [shloka.id])

  const handleSelect = (idx: number) => {
    if (selected !== null) return
    setSelected(idx)
    setTimeout(() => onResult(options[idx].correct), 1000)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="section-label mb-3">Complete the verse</p>
        <p className="font-devanagari text-xl text-text-primary leading-loose text-center bg-elevated rounded-xl p-4">
          {questionLine}
        </p>
        <p className="text-text-muted text-xs text-center mt-1">Select the correct continuation</p>
      </div>

      <div className="space-y-3">
        {options.map((opt, i) => {
          let cls = 'bg-elevated border border-elevated text-text-secondary'
          if (selected !== null) {
            if (opt.correct) cls = 'bg-green-900/40 border border-green-500 text-green-300'
            else if (selected === i) cls = 'bg-red-900/40 border border-red-500 text-red-300'
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-full text-left rounded-xl p-4 font-devanagari text-base leading-relaxed transition-colors ${cls}`}
            >
              {opt.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
