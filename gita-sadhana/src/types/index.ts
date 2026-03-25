export interface WordMeaning {
  word: string
  meaning: string
}

export interface Translation {
  authorId: string
  authorName: string
  language: 'en' | 'hi' | 'other'
  text: string
}

export interface Shloka {
  id: string           // "2.47" or "2.55-57"
  chapter: number
  verse: number        // first verse number
  verseRange: string
  dayAssignment: number
  thematicTag: string
  sanskrit: string
  transliteration: string
  wordMeanings: WordMeaning[]
  translations: Translation[]
  audioPath: string
}

export interface RecallEntry {
  date: string
  quality: number
  mode: 'mcq' | 'fill' | 'self'
}

export interface ShlokaProgress {
  shlokaId: string
  masteryLevel: number   // 0–5
  interval: number       // SRS days
  easeFactor: number     // SM-2 ease factor
  repetitions: number
  nextReviewDate: string // ISO date
  lastReviewDate: string
  recallHistory: RecallEntry[]
  pinned: boolean
}

export interface Session {
  id: string
  date: string           // "YYYY-MM-DD"
  duration: 15 | 30 | 60
  shlokasCovered: string[]
  completed: boolean
  startedAt: string
  completedAt: string | null
}

export interface AppSettings {
  preferredTranslator: string
  defaultSpeed: 'normal' | 'slow'
  showTransliteration: boolean
  reminderEnabled: boolean
  reminderTime: string | null  // "07:00"
  currentDay: number           // 1–54, or 55+ for maintenance
  streakCount: number
  longestStreak: number
  lastSessionDate: string | null
  pushSubscription: string | null
  seeded: boolean
}

export type SessionPhase = 'listen' | 'repeat' | 'understand' | 'recall'
export type RecallMode = 'mcq' | 'fill' | 'self'

export interface SessionShloka {
  shloka: Shloka
  progress: ShlokaProgress
  isNew: boolean
}
