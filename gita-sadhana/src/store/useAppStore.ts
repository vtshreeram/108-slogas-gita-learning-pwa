import { create } from 'zustand'
import type { Shloka, ShlokaProgress, AppSettings, Session } from '../types'
import {
  getAllShlokas, seedShlokas, getSettings, saveSettings,
  getAllProgress, saveProgress, defaultProgress,
  saveSession, getAllSessions,
  DEFAULT_SETTINGS,
} from '../lib/db'
import { today } from '../lib/srs'

interface AppState {
  shlokas: Shloka[]
  progress: Record<string, ShlokaProgress>
  settings: AppSettings
  sessions: Session[]
  initialized: boolean

  init: () => Promise<void>
  updateProgress: (p: ShlokaProgress) => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  addSession: (s: Session) => Promise<void>
  getDueToday: () => ShlokaProgress[]
  getShlokaById: (id: string) => Shloka | undefined
  getProgressById: (id: string) => ShlokaProgress
}

export const useAppStore = create<AppState>((set, get) => ({
  shlokas: [],
  progress: {},
  settings: { ...DEFAULT_SETTINGS },
  sessions: [],
  initialized: false,

  init: async () => {
    // Load or seed shlokas
    let shlokas = await getAllShlokas()
    const settings = await getSettings()

    if (!settings.seeded || shlokas.length === 0) {
      const res = await fetch('/data/shlokas.json')
      const data: Shloka[] = await res.json()
      await seedShlokas(data)
      shlokas = data
      await saveSettings({ ...settings, seeded: true })
    }

    const progressList = await getAllProgress()
    const progressMap: Record<string, ShlokaProgress> = {}
    for (const p of progressList) progressMap[p.shlokaId] = p

    const sessions = await getAllSessions()

    set({ shlokas, progress: progressMap, settings, sessions, initialized: true })
  },

  updateProgress: async (p: ShlokaProgress) => {
    await saveProgress(p)
    set(state => ({ progress: { ...state.progress, [p.shlokaId]: p } }))
  },

  updateSettings: async (patch: Partial<AppSettings>) => {
    const current = get().settings
    const updated = { ...current, ...patch }
    await saveSettings(updated)
    set({ settings: updated })
  },

  addSession: async (s: Session) => {
    await saveSession(s)
    set(state => ({ sessions: [...state.sessions, s] }))
  },

  getDueToday: () => {
    const { progress } = get()
    const date = today()
    return Object.values(progress).filter(
      p => p.nextReviewDate <= date && p.masteryLevel > 0
    )
  },

  getShlokaById: (id: string) => get().shlokas.find(s => s.id === id),

  getProgressById: (id: string) => get().progress[id] ?? defaultProgress(id),
}))
