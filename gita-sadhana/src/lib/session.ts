import type { Shloka, ShlokaProgress, SessionShloka, AppSettings } from '../types'
import { today, isDue } from './srs'
import { defaultProgress } from './db'

// Approximate minutes per phase per shloka
const PHASE_MINUTES = { listen: 3, repeat: 5, understand: 5, recall: 2 }
const FULL_MINUTES = PHASE_MINUTES.listen + PHASE_MINUTES.repeat + PHASE_MINUTES.understand + PHASE_MINUTES.recall // 15
const LITE_MINUTES = PHASE_MINUTES.listen + PHASE_MINUTES.recall // 5

/**
 * Build the ordered queue of shlokas for a session.
 * - 15 min: SRS reviews only (lite phases)
 * - 30 min: 1 new shloka (full) + SRS reviews (lite)
 * - 60 min: 2 new shlokas (full) + SRS reviews (lite)
 */
export function buildSessionQueue(
  shlokas: Shloka[],
  progressMap: Record<string, ShlokaProgress>,
  settings: AppSettings,
  duration: 15 | 30 | 60
): SessionShloka[] {
  const date = today()
  const currentDay = settings.currentDay
  const isMaintenance = currentDay > 54

  // New shlokas for today (by day assignment)
  const newShlokas: SessionShloka[] = isMaintenance
    ? []
    : shlokas
        .filter(s => s.dayAssignment === currentDay)
        .filter(s => {
          const p = progressMap[s.id]
          return !p || p.masteryLevel === 0 // not yet started
        })
        .map(s => ({
          shloka: s,
          progress: progressMap[s.id] ?? defaultProgress(s.id),
          isNew: true,
        }))

  // SRS due shlokas
  const dueShlokas: SessionShloka[] = shlokas
    .filter(s => {
      const p = progressMap[s.id]
      return p && isDue(p, date)
    })
    .sort((a, b) => {
      const pa = progressMap[a.id]!
      const pb = progressMap[b.id]!
      return pa.nextReviewDate.localeCompare(pb.nextReviewDate)
    })
    .map(s => ({
      shloka: s,
      progress: progressMap[s.id]!,
      isNew: false,
    }))

  // Also include pinned shlokas not already in due list
  const pinnedShlokas: SessionShloka[] = shlokas
    .filter(s => {
      const p = progressMap[s.id]
      return p?.pinned && !dueShlokas.find(d => d.shloka.id === s.id)
    })
    .map(s => ({
      shloka: s,
      progress: progressMap[s.id]!,
      isNew: false,
    }))

  // Budget calculation
  let budget = duration
  const queue: SessionShloka[] = []

  // Add new shlokas first (full flow)
  const maxNew = duration === 15 ? 0 : duration === 30 ? 1 : 2
  for (const item of newShlokas.slice(0, maxNew)) {
    if (budget >= FULL_MINUTES) {
      queue.push(item)
      budget -= FULL_MINUTES
    }
  }

  // Add SRS reviews (lite flow)
  for (const item of [...dueShlokas, ...pinnedShlokas]) {
    if (budget >= LITE_MINUTES) {
      queue.push(item)
      budget -= LITE_MINUTES
    } else {
      break
    }
  }

  return queue
}

/** Determine which phases to show for a shloka in the session */
export function phasesForShloka(isNew: boolean): Array<'listen' | 'repeat' | 'understand' | 'recall'> {
  if (isNew) return ['listen', 'repeat', 'understand', 'recall']
  return ['listen', 'recall']
}

/** Compute streak from session history */
export function computeStreak(sessions: { date: string; completed: boolean }[]): {
  current: number
  longest: number
} {
  const completedDates = new Set(
    sessions.filter(s => s.completed).map(s => s.date)
  )

  const sortedDates = Array.from(completedDates).sort().reverse()
  if (sortedDates.length === 0) return { current: 0, longest: 0 }

  const todayStr = today()
  const yesterdayStr = addDays(todayStr, -1)

  // Current streak: consecutive days ending today or yesterday
  let current = 0
  let checkDate = completedDates.has(todayStr) ? todayStr : yesterdayStr
  if (!completedDates.has(checkDate)) return { current: 0, longest: computeLongest(sortedDates) }

  while (completedDates.has(checkDate)) {
    current++
    checkDate = addDays(checkDate, -1)
  }

  return { current, longest: Math.max(current, computeLongest(sortedDates)) }
}

function computeLongest(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0
  let longest = 1
  let run = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diff === 1) {
      run++
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }
  return longest
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
