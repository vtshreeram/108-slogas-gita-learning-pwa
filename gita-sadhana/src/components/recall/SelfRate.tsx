import { useState } from 'react'
import AudioPlayer from '../AudioPlayer'
import type { Shloka } from '../../types'

interface SelfRateProps {
  shloka: Shloka
  onResult: (rating: number) => void
}

const RATINGS = [
  { value: 1, label: 'Blank', desc: 'Complete blackout', color: 'bg-red-900/50 border-red-700 text-red-300' },
  { value: 2, label: 'Hard', desc: 'Barely recalled', color: 'bg-orange-900/50 border-orange-700 text-orange-300' },
  { value: 3, label: 'Okay', desc: 'Recalled with effort', color: 'bg-yellow-900/50 border-yellow-700 text-yellow-300' },
  { value: 4, label: 'Good', desc: 'Recalled correctly', color: 'bg-green-900/50 border-green-700 text-green-300' },
  { value: 5, label: 'Perfect', desc: 'Instant recall', color: 'bg-emerald-900/50 border-emerald-700 text-emerald-300' },
]

export default function SelfRate({ shloka, onResult }: SelfRateProps) {
  const [revealed, setRevealed] = useState(false)

  const lines = shloka.sanskrit.split('\n').filter(Boolean)

  return (
    <div className="space-y-5">
      <div>
        <p className="section-label mb-3">Recall from memory</p>
        <p className="text-text-muted text-sm text-center">
          Listen to the first line, then recite the rest from memory
        </p>
      </div>

      {/* Audio cue — first line only hint */}
      <div className="bg-elevated rounded-xl p-4">
        <p className="font-devanagari text-xl text-gold text-center leading-loose mb-3">
          {lines[0]}
        </p>
        <AudioPlayer src={shloka.audioPath} compact />
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="btn-primary w-full"
        >
          Show Full Verse
        </button>
      ) : (
        <>
          {/* Full verse reveal */}
          <div className="bg-elevated rounded-xl p-4 text-center space-y-1">
            {lines.map((line, i) => (
              <p key={i} className={`font-devanagari text-lg leading-loose ${i === 0 ? 'text-gold' : 'text-text-primary'}`}>
                {line}
              </p>
            ))}
          </div>

          {/* Rating buttons */}
          <div>
            <p className="text-text-muted text-xs text-center mb-3">How well did you recall it?</p>
            <div className="grid grid-cols-5 gap-2">
              {RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => onResult(r.value)}
                  className={`border rounded-xl p-2 text-center transition-transform active:scale-95 ${r.color}`}
                >
                  <p className="font-bold text-sm">{r.value}</p>
                  <p className="text-xs mt-0.5">{r.label}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
