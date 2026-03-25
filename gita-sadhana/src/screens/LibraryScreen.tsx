import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Shloka } from '../types'
import VerseDisplay from '../components/VerseDisplay'
import AudioPlayer from '../components/AudioPlayer'

const TAGS = ['All', 'Dharma & Duty', 'Atman & Immortality', 'Karma Yoga', 'Jnana Yoga', 'Dhyana Yoga', 'Bhakti Yoga', 'Vibhuti', 'Kshetra & Kshetrajna', 'Gunas', 'Purushottama', 'Daivi Svabhava', 'Moksha']
const CHAPTERS = ['All', ...Array.from({ length: 18 }, (_, i) => String(i + 1))]
const MASTERY_FILTERS = ['All', 'New', 'Learning', 'Mastered']

export default function LibraryScreen() {
  const { shlokas, progress, updateProgress } = useAppStore()
  const [selectedTag, setSelectedTag] = useState('All')
  const [selectedChapter, setSelectedChapter] = useState('All')
  const [selectedMastery, setSelectedMastery] = useState('All')
  const [search, setSearch] = useState('')
  const [detailShloka, setDetailShloka] = useState<Shloka | null>(null)

  const filtered = shlokas.filter(s => {
    if (selectedTag !== 'All' && s.thematicTag !== selectedTag) return false
    if (selectedChapter !== 'All' && s.chapter !== parseInt(selectedChapter)) return false
    if (selectedMastery !== 'All') {
      const m = progress[s.id]?.masteryLevel ?? 0
      if (selectedMastery === 'New' && m !== 0) return false
      if (selectedMastery === 'Learning' && (m === 0 || m >= 4)) return false
      if (selectedMastery === 'Mastered' && m < 4) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return s.id.includes(q) || s.sanskrit.toLowerCase().includes(q) || s.transliteration.toLowerCase().includes(q)
    }
    return true
  })

  const togglePin = async (shloka: Shloka) => {
    const p = progress[shloka.id]
    if (!p) return
    await updateProgress({ ...p, pinned: !p.pinned })
  }

  if (detailShloka) {
    const p = progress[detailShloka.id]
    return (
      <div className="min-h-screen bg-base flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-elevated">
          <button onClick={() => setDetailShloka(null)} className="text-text-muted p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="text-text-primary font-semibold">BG {detailShloka.verseRange}</span>
          <button
            onClick={() => togglePin(detailShloka)}
            className="ml-auto text-text-muted"
            title={p?.pinned ? 'Unpin' : 'Pin for review'}
          >
            <svg className={`w-5 h-5 ${p?.pinned ? 'text-gold fill-gold' : ''}`} fill={p?.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-6 pb-24 max-w-lg mx-auto w-full space-y-6">
          <AudioPlayer src={detailShloka.audioPath} lines={detailShloka.sanskrit.split('\n').filter(Boolean)} />
          <VerseDisplay shloka={detailShloka} showSynonyms showTranslation showTransliteration />
          {p && (
            <div className="card space-y-2">
              <p className="section-label">Your Progress</p>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Mastery</span>
                <span className="text-text-primary">{'★'.repeat(p.masteryLevel)}{'☆'.repeat(5 - p.masteryLevel)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Next review</span>
                <span className="text-text-primary">{p.nextReviewDate || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Reviews done</span>
                <span className="text-text-primary">{p.repetitions}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 sticky top-0 bg-base z-10">
        <h2 className="text-text-primary font-bold text-xl mb-3">Library</h2>
        <input
          type="search"
          placeholder="Search shlokas..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface text-text-primary rounded-xl px-4 py-2.5 text-sm outline-none border border-elevated focus:border-gold transition-colors placeholder:text-text-muted mb-3"
        />
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {MASTERY_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setSelectedMastery(f)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedMastery === f ? 'bg-gold text-base' : 'bg-elevated text-text-secondary'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="w-px bg-elevated shrink-0 mx-1" />
          {CHAPTERS.slice(0, 7).map(c => (
            <button
              key={c}
              onClick={() => setSelectedChapter(c)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedChapter === c ? 'bg-gold text-base' : 'bg-elevated text-text-secondary'
              }`}
            >
              {c === 'All' ? 'All Ch.' : `Ch.${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* Tag filter */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {TAGS.map(t => (
          <button
            key={t}
            onClick={() => setSelectedTag(t)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedTag === t ? 'bg-rust/80 text-text-primary' : 'bg-elevated text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="px-4 text-text-muted text-xs mb-3">{filtered.length} shlokas</p>

      {/* Grid */}
      <div className="px-4 grid grid-cols-1 gap-3">
        {filtered.map(shloka => {
          const p = progress[shloka.id]
          const mastery = p?.masteryLevel ?? 0
          const firstLine = shloka.sanskrit.split('\n')[0]
          return (
            <button
              key={shloka.id}
              onClick={() => setDetailShloka(shloka)}
              className="card text-left hover:border-gold/30 border border-transparent transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="section-label">BG {shloka.verseRange}</span>
                    <span className="text-text-muted text-xs">· {shloka.thematicTag}</span>
                  </div>
                  <p className="font-devanagari text-text-primary text-base leading-relaxed truncate">
                    {firstLine}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-gold text-xs">{'★'.repeat(mastery)}{'☆'.repeat(5 - mastery)}</span>
                  {p?.pinned && (
                    <svg className="w-3.5 h-3.5 text-gold fill-gold" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                    </svg>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
