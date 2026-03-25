import type { ShlokaProgress, RecallEntry } from '../types'

/**
 * SM-2 spaced repetition algorithm.
 * quality: 0–5 (0 = complete blackout, 5 = perfect recall)
 */
export function calculateNextReview(
  quality: number,
  progress: ShlokaProgress,
  today: string
): ShlokaProgress {
  const q = Math.max(0, Math.min(5, quality))

  let { interval, easeFactor, repetitions, masteryLevel } = progress

  if (q < 3) {
    // Failed recall — reset repetitions, short interval
    repetitions = 0
    interval = 1
  } else {
    // Successful recall
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  }

  // Update ease factor (SM-2 formula)
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

  // Update mastery level (0–5) based on repetitions and quality
  if (q >= 4 && repetitions >= 5) masteryLevel = 5
  else if (q >= 4 && repetitions >= 3) masteryLevel = 4
  else if (q >= 3 && repetitions >= 2) masteryLevel = 3
  else if (q >= 3 && repetitions >= 1) masteryLevel = 2
  else if (q >= 3) masteryLevel = 1
  else masteryLevel = Math.max(0, masteryLevel - 1)

  const nextReviewDate = addDays(today, interval)

  return {
    ...progress,
    interval,
    easeFactor,
    repetitions,
    masteryLevel,
    nextReviewDate,
    lastReviewDate: today,
  }
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

/** Map recall mode result to SM-2 quality score */
export function recallQuality(
  mode: RecallEntry['mode'],
  correct: boolean,
  selfRating?: number
): number {
  if (mode === 'self' && selfRating !== undefined) {
    // self-rate 1–5 → SM-2 quality 1–5
    return Math.max(1, Math.min(5, selfRating))
  }
  if (mode === 'mcq') return correct ? 4 : 1
  if (mode === 'fill') return correct ? 4 : 1
  return correct ? 4 : 1
}

/** Determine recall mode based on mastery level */
export function recallModeForMastery(masteryLevel: number): RecallEntry['mode'] {
  if (masteryLevel <= 1) return 'mcq'
  if (masteryLevel <= 3) return 'fill'
  return 'self'
}

/** Check if a shloka is due for review today */
export function isDue(progress: ShlokaProgress, date: string): boolean {
  return progress.nextReviewDate <= date && progress.masteryLevel > 0
}
