import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Shloka, ShlokaProgress, Session, AppSettings } from '../types'

interface GitaDB extends DBSchema {
  shlokas: {
    key: string
    value: Shloka
    indexes: { 'by-chapter': number; 'by-day': number }
  }
  progress: {
    key: string
    value: ShlokaProgress
    indexes: { 'by-next-review': string; 'by-mastery': number }
  }
  sessions: {
    key: string
    value: Session
    indexes: { 'by-date': string }
  }
  settings: {
    key: string
    value: AppSettings
  }
}

let dbInstance: IDBPDatabase<GitaDB> | null = null

export async function getDB(): Promise<IDBPDatabase<GitaDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<GitaDB>('gita-sadhana', 1, {
    upgrade(db) {
      const shlokaStore = db.createObjectStore('shlokas', { keyPath: 'id' })
      shlokaStore.createIndex('by-chapter', 'chapter')
      shlokaStore.createIndex('by-day', 'dayAssignment')

      const progressStore = db.createObjectStore('progress', { keyPath: 'shlokaId' })
      progressStore.createIndex('by-next-review', 'nextReviewDate')
      progressStore.createIndex('by-mastery', 'masteryLevel')

      const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
      sessionStore.createIndex('by-date', 'date')

      db.createObjectStore('settings', { keyPath: 'key' })
    },
  })
  return dbInstance
}

// ── Shlokas ──────────────────────────────────────────────────────────────────

export async function seedShlokas(shlokas: Shloka[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('shlokas', 'readwrite')
  await Promise.all([...shlokas.map(s => tx.store.put(s)), tx.done])
}

export async function getAllShlokas(): Promise<Shloka[]> {
  const db = await getDB()
  return db.getAll('shlokas')
}

export async function getShloka(id: string): Promise<Shloka | undefined> {
  const db = await getDB()
  return db.get('shlokas', id)
}

// ── Progress ─────────────────────────────────────────────────────────────────

export function defaultProgress(shlokaId: string): ShlokaProgress {
  return {
    shlokaId,
    masteryLevel: 0,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    nextReviewDate: new Date().toISOString().split('T')[0],
    lastReviewDate: '',
    recallHistory: [],
    pinned: false,
  }
}

export async function getProgress(shlokaId: string): Promise<ShlokaProgress> {
  const db = await getDB()
  return (await db.get('progress', shlokaId)) ?? defaultProgress(shlokaId)
}

export async function getAllProgress(): Promise<ShlokaProgress[]> {
  const db = await getDB()
  return db.getAll('progress')
}

export async function saveProgress(progress: ShlokaProgress): Promise<void> {
  const db = await getDB()
  await db.put('progress', progress)
}

export async function getDueShlokas(date: string): Promise<ShlokaProgress[]> {
  const db = await getDB()
  const all = await db.getAll('progress')
  return all.filter(p => p.nextReviewDate <= date && p.masteryLevel > 0)
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function saveSession(session: Session): Promise<void> {
  const db = await getDB()
  await db.put('sessions', session)
}

export async function getSessionByDate(date: string): Promise<Session | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex('sessions', 'by-date', date)
  return all.find(s => s.completed)
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB()
  return db.getAll('sessions')
}

// ── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'user'

export const DEFAULT_SETTINGS: AppSettings = {
  preferredTranslator: '16', // Prabhupada author ID in gita/gita dataset
  defaultSpeed: 'normal',
  showTransliteration: true,
  reminderEnabled: false,
  reminderTime: '07:00',
  currentDay: 1,
  streakCount: 0,
  longestStreak: 0,
  lastSessionDate: null,
  pushSubscription: null,
  seeded: false,
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB()
  const row = await db.get('settings', SETTINGS_KEY)
  return row ? (row as unknown as AppSettings) : { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key: SETTINGS_KEY, ...settings } as unknown as AppSettings)
}

// ── Export / Import ───────────────────────────────────────────────────────────

export async function exportData(): Promise<string> {
  const [progress, sessions, settings] = await Promise.all([
    getAllProgress(),
    getAllSessions(),
    getSettings(),
  ])
  return JSON.stringify({ progress, sessions, settings, exportedAt: new Date().toISOString() }, null, 2)
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json)
  const db = await getDB()

  if (data.progress) {
    const tx = db.transaction('progress', 'readwrite')
    await Promise.all([...data.progress.map((p: ShlokaProgress) => tx.store.put(p)), tx.done])
  }
  if (data.sessions) {
    const tx = db.transaction('sessions', 'readwrite')
    await Promise.all([...data.sessions.map((s: Session) => tx.store.put(s)), tx.done])
  }
  if (data.settings) {
    await saveSettings(data.settings)
  }
}

export async function resetProgress(): Promise<void> {
  const db = await getDB()
  await db.clear('progress')
  await db.clear('sessions')
  await saveSettings({ ...DEFAULT_SETTINGS, seeded: true })
}
