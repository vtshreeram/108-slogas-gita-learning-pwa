import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { today } from '../lib/srs'
import { exportData, importData } from '../lib/db'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function ProgressScreen() {
  const { shlokas, progress, settings, sessions } = useAppStore()

  const todayStr = today()

  // Build 54-day calendar
  const calendarDays = useMemo(() => {
    const startDate = addDays(todayStr, -(settings.currentDay - 1))
    return Array.from({ length: 54 }, (_, i) => {
      const date = addDays(startDate, i)
      const dayNum = i + 1
      const session = sessions.find(s => s.date === date && s.completed)
      const isFuture = date > todayStr
      const isToday = date === todayStr
      return { date, dayNum, done: !!session, isFuture, isToday }
    })
  }, [sessions, settings.currentDay, todayStr])

  // Mastery distribution
  const masteryDist = [0, 1, 2, 3, 4, 5].map(level => ({
    level,
    count: Object.values(progress).filter(p => p.masteryLevel === level).length,
  }))

  const handleExport = async () => {
    const json = await exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gita-sadhana-backup-${todayStr}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        await importData(text)
        window.location.reload()
      } catch {
        alert('Invalid backup file')
      }
    }
    input.click()
  }

  const learnedCount = Object.values(progress).filter(p => p.masteryLevel > 0).length
  const masteredCount = Object.values(progress).filter(p => p.masteryLevel >= 4).length

  return (
    <div className="flex flex-col pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-text-primary font-bold text-xl">Progress</h2>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-gold font-bold text-2xl">{settings.streakCount}</p>
          <p className="text-text-muted text-xs mt-1">Current streak</p>
        </div>
        <div className="card text-center">
          <p className="text-text-primary font-bold text-2xl">{learnedCount}</p>
          <p className="text-text-muted text-xs mt-1">Learned</p>
        </div>
        <div className="card text-center">
          <p className="text-text-primary font-bold text-2xl">{masteredCount}</p>
          <p className="text-text-muted text-xs mt-1">Mastered</p>
        </div>
      </div>

      {/* 54-day heatmap */}
      <div>
        <p className="section-label mb-3">54-Day Journey</p>
        <div className="grid grid-cols-9 gap-1.5">
          {calendarDays.map(({ dayNum, done, isFuture, isToday }) => (
            <div
              key={dayNum}
              title={`Day ${dayNum}`}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                isFuture
                  ? 'bg-elevated text-text-muted'
                  : done
                  ? 'bg-green-700 text-green-100'
                  : isToday
                  ? 'bg-gold/30 text-gold border border-gold/50'
                  : 'bg-red-900/40 text-red-400'
              }`}
            >
              {dayNum}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-700 inline-block"/>Done</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/40 inline-block"/>Missed</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-elevated inline-block"/>Upcoming</span>
        </div>
      </div>

      {/* Mastery distribution */}
      <div>
        <p className="section-label mb-3">Mastery Distribution</p>
        <div className="space-y-2">
          {masteryDist.map(({ level, count }) => {
            const pct = shlokas.length > 0 ? (count / shlokas.length) * 100 : 0
            const labels = ['New', 'Introduced', 'Familiar', 'Learning', 'Proficient', 'Mastered']
            const colors = ['bg-elevated', 'bg-red-800', 'bg-orange-800', 'bg-yellow-800', 'bg-green-800', 'bg-emerald-700']
            return (
              <div key={level} className="flex items-center gap-3">
                <span className="text-text-muted text-xs w-20 shrink-0">{labels[level]}</span>
                <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colors[level]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-text-secondary text-xs w-6 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chapter breakdown */}
      <div>
        <p className="section-label mb-3">By Chapter</p>
        <div className="space-y-2">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(ch => {
            const chShlokas = shlokas.filter(s => s.chapter === ch)
            const learned = chShlokas.filter(s => (progress[s.id]?.masteryLevel ?? 0) > 0).length
            const pct = chShlokas.length > 0 ? (learned / chShlokas.length) * 100 : 0
            return (
              <div key={ch} className="flex items-center gap-3">
                <span className="text-text-muted text-xs w-14 shrink-0">Ch. {ch}</span>
                <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-text-secondary text-xs w-10 text-right">{learned}/{chShlokas.length}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Export / Import */}
      <div className="card space-y-3">
        <p className="section-label">Data</p>
        <button onClick={handleExport} className="w-full bg-elevated text-text-primary rounded-xl px-4 py-3 text-sm font-medium text-left flex items-center gap-3">
          <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export backup (JSON)
        </button>
        <button onClick={handleImport} className="w-full bg-elevated text-text-primary rounded-xl px-4 py-3 text-sm font-medium text-left flex items-center gap-3">
          <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
          </svg>
          Import backup (JSON)
        </button>
      </div>
    </div>
  )
}
