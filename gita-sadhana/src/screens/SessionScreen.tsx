import { useState, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildSessionQueue, phasesForShloka, computeStreak } from '../lib/session'
import { calculateNextReview, recallQuality, recallModeForMastery, today } from '../lib/srs'
import type { SessionShloka, SessionPhase } from '../types'
import AudioPlayer from '../components/AudioPlayer'
import VerseDisplay from '../components/VerseDisplay'
import MCQ from '../components/recall/MCQ'
import FillBlank from '../components/recall/FillBlank'
import SelfRate from '../components/recall/SelfRate'
import { v4 as uuidv4 } from 'uuid'

interface SessionScreenProps {
  duration: 15 | 30 | 60
  onComplete: () => void
  onExit: () => void
}

interface PhaseResult {
  shlokaId: string
  quality: number
  mode: 'mcq' | 'fill' | 'self'
}

export default function SessionScreen({ duration, onComplete, onExit }: SessionScreenProps) {
  const { shlokas, progress, settings, sessions, updateProgress, updateSettings, addSession } = useAppStore()

  const [queue] = useState<SessionShloka[]>(() =>
    buildSessionQueue(shlokas, progress, settings, duration)
  )
  const [queueIdx, setQueueIdx] = useState(0)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [results, setResults] = useState<PhaseResult[]>([])
  const [sessionId] = useState(() => uuidv4())
  const [sessionStarted] = useState(() => new Date().toISOString())
  const [showSummary, setShowSummary] = useState(false)

  const currentItem = queue[queueIdx]
  const phases = currentItem ? phasesForShloka(currentItem.isNew) : []
  const currentPhase: SessionPhase = phases[phaseIdx] ?? 'listen'

  const totalPhases = queue.reduce((acc, item) => acc + phasesForShloka(item.isNew).length, 0)
  const completedPhases = queue.slice(0, queueIdx).reduce((acc, item) => acc + phasesForShloka(item.isNew).length, 0) + phaseIdx
  const progressPct = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0

  const advancePhase = useCallback(() => {
    if (phaseIdx < phases.length - 1) {
      setPhaseIdx(p => p + 1)
    } else if (queueIdx < queue.length - 1) {
      setQueueIdx(q => q + 1)
      setPhaseIdx(0)
    } else {
      finishSession()
    }
  }, [phaseIdx, phases.length, queueIdx, queue.length])

  const handleRecallResult = useCallback(async (correct: boolean, selfRating?: number) => {
    if (!currentItem) return
    const mode = recallModeForMastery(currentItem.progress.masteryLevel)
    const quality = recallQuality(mode, correct, selfRating)
    const todayStr = today()

    const updated = calculateNextReview(quality, currentItem.progress, todayStr)
    updated.recallHistory = [
      ...updated.recallHistory,
      { date: todayStr, quality, mode },
    ]
    await updateProgress(updated)

    setResults(r => [...r, { shlokaId: currentItem.shloka.id, quality, mode }])
    setTimeout(advancePhase, 800)
  }, [currentItem, updateProgress, advancePhase])

  const finishSession = useCallback(async () => {
    const todayStr = today()
    const session = {
      id: sessionId,
      date: todayStr,
      duration,
      shlokasCovered: queue.map(q => q.shloka.id),
      completed: true,
      startedAt: sessionStarted,
      completedAt: new Date().toISOString(),
    }
    await addSession(session)

    // Update streak
    const allSessions = [...sessions, session]
    const { current, longest } = computeStreak(allSessions)
    const newDay = settings.currentDay <= 54 ? settings.currentDay + 1 : settings.currentDay
    await updateSettings({
      streakCount: current,
      longestStreak: Math.max(longest, settings.longestStreak),
      lastSessionDate: todayStr,
      currentDay: newDay,
    })

    setShowSummary(true)
  }, [queue, sessions, settings, sessionId, sessionStarted, duration, addSession, updateSettings])

  if (queue.length === 0) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">🙏</div>
        <h2 className="text-text-primary font-bold text-xl text-center">Nothing due today</h2>
        <p className="text-text-secondary text-center">All shlokas are up to date. Come back tomorrow!</p>
        <button onClick={onExit} className="btn-primary">Back to Home</button>
      </div>
    )
  }

  if (showSummary) {
    const avgQuality = results.length > 0
      ? (results.reduce((a, b) => a + b.quality, 0) / results.length).toFixed(1)
      : '—'
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-6 px-6 max-w-lg mx-auto">
        <div className="text-5xl">✨</div>
        <h2 className="text-text-primary font-bold text-2xl text-center">Session Complete!</h2>
        <div className="w-full card space-y-4">
          <div className="flex justify-between">
            <span className="text-text-secondary">Shlokas covered</span>
            <span className="text-text-primary font-semibold">{queue.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Recall score</span>
            <span className="text-text-primary font-semibold">{avgQuality} / 5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Streak</span>
            <span className="text-gold font-bold">🔥 {settings.streakCount + 1} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Duration</span>
            <span className="text-text-primary font-semibold">{duration} min</span>
          </div>
        </div>
        <button onClick={onComplete} className="btn-primary w-full">Back to Home</button>
      </div>
    )
  }

  if (!currentItem) return null

  const { shloka } = currentItem
  const lines = shloka.sanskrit.split('\n').filter(Boolean)

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-elevated">
        <button onClick={onExit} className="text-text-muted p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-text-muted text-xs">
            BG {shloka.verseRange} · {currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)}
          </p>
          <div className="mt-1.5 h-1.5 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <span className="text-text-muted text-xs">{queueIdx + 1}/{queue.length}</span>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-elevated">
        {phases.map((ph, i) => (
          <div
            key={ph}
            className={`flex-1 h-1 rounded-full transition-colors ${
              i < phaseIdx ? 'bg-gold' : i === phaseIdx ? 'bg-gold/60' : 'bg-elevated'
            }`}
          />
        ))}
      </div>

      {/* Phase label */}
      <div className="px-4 pt-4 pb-2">
        <span className="section-label">
          {currentPhase === 'listen' && 'Phase 1 — Listen'}
          {currentPhase === 'repeat' && 'Phase 2 — Repeat'}
          {currentPhase === 'understand' && 'Phase 3 — Understand'}
          {currentPhase === 'recall' && 'Phase 4 — Recall'}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32">
        {/* Listen phase */}
        {currentPhase === 'listen' && (
          <div className="space-y-6 pt-2">
            <VerseDisplay shloka={shloka} />
            <AudioPlayer src={shloka.audioPath} lines={lines} />
          </div>
        )}

        {/* Repeat phase */}
        {currentPhase === 'repeat' && (
          <div className="space-y-6 pt-2">
            <VerseDisplay shloka={shloka} showTransliteration />
            <AudioPlayer src={shloka.audioPath} lines={lines} />
            <p className="text-text-muted text-sm text-center">
              Enable Line mode and repeat each line aloud during the pause
            </p>
          </div>
        )}

        {/* Understand phase */}
        {currentPhase === 'understand' && (
          <div className="space-y-6 pt-2">
            <VerseDisplay shloka={shloka} showSynonyms showTranslation />
            <AudioPlayer src={shloka.audioPath} compact />
          </div>
        )}

        {/* Recall phase */}
        {currentPhase === 'recall' && (() => {
          const mode = recallModeForMastery(currentItem.progress.masteryLevel)
          if (mode === 'mcq') {
            return (
              <div className="pt-2">
                <MCQ
                  shloka={shloka}
                  allShlokas={shlokas}
                  onResult={correct => handleRecallResult(correct)}
                />
              </div>
            )
          }
          if (mode === 'fill') {
            return (
              <div className="pt-2">
                <FillBlank
                  shloka={shloka}
                  onResult={correct => handleRecallResult(correct)}
                />
              </div>
            )
          }
          return (
            <div className="pt-2">
              <SelfRate
                shloka={shloka}
                onResult={rating => handleRecallResult(rating >= 3, rating)}
              />
            </div>
          )
        })()}
      </div>

      {/* Bottom action — shown for non-recall phases */}
      {currentPhase !== 'recall' && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pb-6 pt-4 bg-gradient-to-t from-base via-base/95 to-transparent">
          <button onClick={advancePhase} className="btn-primary w-full max-w-lg mx-auto block">
            {currentPhase === 'listen' && 'Next →'}
            {currentPhase === 'repeat' && 'Done Repeating →'}
            {currentPhase === 'understand' && 'I Understand →'}
          </button>
        </div>
      )}
    </div>
  )
}
