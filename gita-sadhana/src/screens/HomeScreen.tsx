import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { today } from '../lib/srs'

const YT_PLAYLIST = 'https://www.youtube.com/watch?v=NcH9Iff4tYY&list=PLX0Ub3o9M5sIwlsm_qirzkwfDv2J7LHsV'
const CHAPTERS = Array.from({ length: 18 }, (_, i) => i + 1)

interface HomeScreenProps {
  onStartSession: (duration: 15 | 30 | 60) => void
}

export default function HomeScreen({ onStartSession }: HomeScreenProps) {
  const { shlokas, progress, settings, sessions } = useAppStore()
  const [showDurationPicker, setShowDurationPicker] = useState(false)

  const todayStr = today()
  const isMaintenance = settings.currentDay > 54
  const dayLabel = isMaintenance ? 'Maintenance' : `Day ${settings.currentDay} of 54`

  const learnedCount = Object.values(progress).filter(p => p.masteryLevel > 0).length
  const dueCount = Object.values(progress).filter(p => p.nextReviewDate <= todayStr && p.masteryLevel > 0).length
  const todayDone = sessions.some(s => s.date === todayStr && s.completed)

  // Chapter completion
  const chapterProgress = CHAPTERS.map(ch => {
    const chShlokas = shlokas.filter(s => s.chapter === ch)
    const learned = chShlokas.filter(s => (progress[s.id]?.masteryLevel ?? 0) > 0).length
    return { ch, total: chShlokas.length, learned }
  })

  const progressPct = shlokas.length > 0 ? (learnedCount / shlokas.length) * 100 : 0
  const circumference = 2 * Math.PI * 44 // r=44

  return (
    <div className="flex flex-col gap-6 pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-text-primary font-bold text-xl">Gita Sadhana</h1>
          <p className="text-text-muted text-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <a
          href={YT_PLAYLIST}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-elevated px-3 py-2 rounded-xl text-xs text-text-secondary"
        >
          <svg className="w-3.5 h-3.5 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          YouTube
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Progress ring */}
        <div className="card flex flex-col items-center gap-2 col-span-1">
          <svg width="100" height="100" className="-rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#2C2C2E" strokeWidth="8"/>
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke="#C8922A" strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progressPct / 100)}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="text-center -mt-14">
            <p className="text-text-primary font-bold text-lg">{learnedCount}</p>
            <p className="text-text-muted text-xs">of 108</p>
          </div>
          <p className="text-text-secondary text-xs mt-8">Learned</p>
        </div>

        <div className="col-span-2 flex flex-col gap-3">
          {/* Streak */}
          <div className="card flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-text-primary font-bold text-xl">{settings.streakCount}</p>
              <p className="text-text-muted text-xs">day streak</p>
            </div>
          </div>
          {/* Due today */}
          <div className="card flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <p className="text-text-primary font-bold text-xl">{dueCount}</p>
              <p className="text-text-muted text-xs">due for review</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's session card */}
      <div className="card border border-elevated">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-label">{dayLabel}</p>
            <p className="text-text-primary font-semibold text-lg mt-1">
              {isMaintenance ? 'Maintenance Mode' : "Today's Practice"}
            </p>
            <p className="text-text-secondary text-sm mt-0.5">
              {isMaintenance
                ? 'Keep the flame alive with SRS reviews'
                : `${dueCount} reviews · ${settings.currentDay <= 54 ? '2 new shlokas' : ''}`}
            </p>
          </div>
          {todayDone && (
            <div className="w-10 h-10 rounded-full bg-green-900/40 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          )}
        </div>

        {!todayDone ? (
          !showDurationPicker ? (
            <button
              onClick={() => setShowDurationPicker(true)}
              className="btn-primary w-full"
            >
              Start Practice
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-text-muted text-xs text-center mb-3">How much time do you have?</p>
              {([15, 30, 60] as const).map(d => (
                <button
                  key={d}
                  onClick={() => onStartSession(d)}
                  className="w-full bg-elevated hover:bg-gold/10 border border-elevated hover:border-gold/40 rounded-xl px-4 py-3 text-left transition-colors"
                >
                  <span className="text-text-primary font-semibold">{d} min</span>
                  <span className="text-text-muted text-sm ml-2">
                    {d === 15 ? '— Reviews only' : d === 30 ? '— 1 new shloka + reviews' : '— 2 new shlokas + reviews'}
                  </span>
                </button>
              ))}
              <button onClick={() => setShowDurationPicker(false)} className="w-full text-text-muted text-sm py-2">
                Cancel
              </button>
            </div>
          )
        ) : (
          <p className="text-green-400 text-sm text-center font-medium">✓ Practice complete for today</p>
        )}
      </div>

      {/* Chapter progress grid */}
      <div>
        <p className="section-label mb-3">Chapters</p>
        <div className="grid grid-cols-6 gap-2">
          {chapterProgress.map(({ ch, total, learned }) => {
            const pct = total > 0 ? learned / total : 0
            const bg = pct === 0 ? 'bg-elevated' : pct === 1 ? 'bg-green-800' : 'bg-gold/30'
            const text = pct === 0 ? 'text-text-muted' : pct === 1 ? 'text-green-300' : 'text-gold'
            return (
              <div key={ch} className={`${bg} rounded-xl p-2 text-center`}>
                <p className={`font-bold text-sm ${text}`}>{ch}</p>
                <p className="text-text-muted text-xs">{learned}/{total}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
