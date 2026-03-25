import { useEffect, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import HomeScreen from './screens/HomeScreen'
import SessionScreen from './screens/SessionScreen'
import LibraryScreen from './screens/LibraryScreen'
import ProgressScreen from './screens/ProgressScreen'
import SettingsScreen from './screens/SettingsScreen'

type Tab = 'home' | 'library' | 'progress' | 'settings'

export default function App() {
  const { init, initialized } = useAppStore()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [sessionDuration, setSessionDuration] = useState<15 | 30 | 60 | null>(null)

  useEffect(() => { init() }, [])

  if (!initialized) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-gold border-t-transparent animate-spin" />
        <p className="text-text-muted text-sm">Loading Gita Sadhana…</p>
      </div>
    )
  }

  if (sessionDuration !== null) {
    return (
      <SessionScreen
        duration={sessionDuration}
        onComplete={() => { setSessionDuration(null); setActiveTab('home') }}
        onExit={() => setSessionDuration(null)}
      />
    )
  }

  const tabs = [
    { id: 'home' as Tab, label: 'Home', activeIcon: '🏠', icon: '🏡' },
    { id: 'library' as Tab, label: 'Library', activeIcon: '📖', icon: '📚' },
    { id: 'progress' as Tab, label: 'Progress', activeIcon: '📊', icon: '📈' },
    { id: 'settings' as Tab, label: 'Settings', activeIcon: '⚙️', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-base flex flex-col">
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'home' && <HomeScreen onStartSession={(d) => setSessionDuration(d)} />}
        {activeTab === 'library' && <LibraryScreen />}
        {activeTab === 'progress' && <ProgressScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-elevated" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex max-w-lg mx-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 active:opacity-70 transition-opacity"
            >
              <span className="text-xl">{activeTab === tab.id ? tab.activeIcon : tab.icon}</span>
              <span className={`text-xs font-medium ${activeTab === tab.id ? 'text-gold' : 'text-text-muted'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
