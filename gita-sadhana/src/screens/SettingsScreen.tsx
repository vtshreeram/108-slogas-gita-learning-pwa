import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { resetProgress } from '../lib/db'

const TRANSLATORS = [
  { id: '16', name: 'Swami Prabhupada' },
  { id: '1',  name: 'Swami Sivananda' },
  { id: '2',  name: 'Swami Gambirananda' },
  { id: '3',  name: 'Swami Adidevananda' },
  { id: '17', name: 'Purohit Swami' },
  { id: '14', name: 'Dr. S. Sankaranarayan' },
]

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppStore()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (patch: Parameters<typeof updateSettings>[0]) => {
    await updateSettings(patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleReset = async () => {
    await resetProgress()
    window.location.reload()
  }

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Notifications not supported in this browser')
      return
    }
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      await save({ reminderEnabled: true })
    } else {
      alert('Notification permission denied')
    }
  }

  return (
    <div className="flex flex-col pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary font-bold text-xl">Settings</h2>
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
      </div>

      {/* Translator */}
      <div className="card space-y-3">
        <p className="section-label">Default Translator</p>
        <div className="space-y-2">
          {TRANSLATORS.map(t => (
            <button
              key={t.id}
              onClick={() => save({ preferredTranslator: t.id })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                settings.preferredTranslator === t.id
                  ? 'bg-gold/20 border border-gold/40'
                  : 'bg-elevated border border-transparent'
              }`}
            >
              <span className={`text-sm font-medium ${settings.preferredTranslator === t.id ? 'text-gold' : 'text-text-primary'}`}>
                {t.name}
              </span>
              {settings.preferredTranslator === t.id && (
                <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Audio */}
      <div className="card space-y-4">
        <p className="section-label">Audio</p>
        <div className="flex items-center justify-between">
          <span className="text-text-primary text-sm">Default speed</span>
          <div className="flex gap-2">
            {(['normal', 'slow'] as const).map(s => (
              <button
                key={s}
                onClick={() => save({ defaultSpeed: s })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  settings.defaultSpeed === s ? 'bg-gold text-base' : 'bg-elevated text-text-secondary'
                }`}
              >
                {s === 'normal' ? '1×' : '¾×'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Display */}
      <div className="card space-y-4">
        <p className="section-label">Display</p>
        <div className="flex items-center justify-between">
          <span className="text-text-primary text-sm">Show transliteration by default</span>
          <button
            onClick={() => save({ showTransliteration: !settings.showTransliteration })}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              settings.showTransliteration ? 'bg-gold' : 'bg-elevated'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              settings.showTransliteration ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Reminder */}
      <div className="card space-y-4">
        <p className="section-label">Daily Reminder</p>
        <div className="flex items-center justify-between">
          <span className="text-text-primary text-sm">Enable reminder</span>
          <button
            onClick={() => {
              if (!settings.reminderEnabled) {
                requestNotificationPermission()
              } else {
                save({ reminderEnabled: false })
              }
            }}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              settings.reminderEnabled ? 'bg-gold' : 'bg-elevated'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              settings.reminderEnabled ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>
        {settings.reminderEnabled && (
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">Reminder time</span>
            <input
              type="time"
              value={settings.reminderTime ?? '07:00'}
              onChange={e => save({ reminderTime: e.target.value })}
              className="bg-elevated text-text-primary text-sm rounded-lg px-3 py-1.5 outline-none border border-elevated focus:border-gold"
            />
          </div>
        )}
      </div>

      {/* Journey */}
      <div className="card space-y-4">
        <p className="section-label">Journey</p>
        <div className="flex items-center justify-between">
          <span className="text-text-primary text-sm">Current day</span>
          <span className="text-text-secondary text-sm">
            {settings.currentDay > 54 ? 'Maintenance' : `Day ${settings.currentDay} of 54`}
          </span>
        </div>
        {settings.currentDay > 54 && (
          <button
            onClick={() => save({ currentDay: 1 })}
            className="w-full bg-elevated text-text-primary rounded-xl px-4 py-3 text-sm font-medium"
          >
            Restart 54-day journey
          </button>
        )}
      </div>

      {/* About */}
      <div className="card space-y-2">
        <p className="section-label">About</p>
        <p className="text-text-secondary text-sm">Gita Sadhana v1.0</p>
        <p className="text-text-muted text-xs leading-relaxed">
          Shloka data from{' '}
          <a href="https://github.com/gita/gita" target="_blank" rel="noopener noreferrer" className="text-gold underline">
            gita/gita
          </a>{' '}
          (The Unlicense). Translations by A.C. Bhaktivedanta Swami Prabhupada and others.
          108 shlokas from the Bhakti-sastri Study Guide (Bhaktivedanta Academy, Mayapur).
        </p>
      </div>

      {/* Reset */}
      <div className="card space-y-3">
        <p className="section-label text-red-400">Danger Zone</p>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full bg-red-900/30 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm font-medium"
          >
            Reset all progress
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-text-secondary text-sm">This will delete all progress and sessions. Are you sure?</p>
            <div className="flex gap-2">
              <button onClick={handleReset} className="flex-1 bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold">
                Yes, reset
              </button>
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-elevated text-text-secondary rounded-xl py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
