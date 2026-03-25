import { useEffect, useRef, useState, useCallback } from 'react'

interface AudioPlayerProps {
  src: string
  lines?: string[]          // for line-by-line repeat mode
  compact?: boolean
  youtubeUrl?: string
  onEnded?: () => void
}

const YT_PLAYLIST = 'https://www.youtube.com/watch?v=NcH9Iff4tYY&list=PLX0Ub3o9M5sIwlsm_qirzkwfDv2J7LHsV'

export default function AudioPlayer({ src, lines, compact = false, youtubeUrl, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 0.75>(1)
  const [lineMode, setLineMode] = useState(false)
  const [activeLine, setActiveLine] = useState(-1)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = speed
  }, [speed])

  useEffect(() => {
    // Reset when src changes
    setPlaying(false)
    setActiveLine(-1)
    setLoaded(false)
  }, [src])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.playbackRate = speed
      await audio.play().catch(() => {})
      setPlaying(true)
    }
  }, [playing, speed])

  const replay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.playbackRate = speed
    audio.play().catch(() => {})
    setPlaying(true)
  }, [speed])

  const toggleSpeed = () => setSpeed(s => s === 1 ? 0.75 : 1)

  const handleEnded = () => {
    setPlaying(false)
    setActiveLine(-1)
    onEnded?.()
  }

  // Line-by-line mode: simulate by splitting duration
  useEffect(() => {
    if (!lineMode || !lines?.length || !playing) return
    const audio = audioRef.current
    if (!audio) return

    const duration = audio.duration || 10
    const segDuration = duration / lines.length

    const interval = setInterval(() => {
      const idx = Math.floor(audio.currentTime / segDuration)
      setActiveLine(Math.min(idx, lines.length - 1))
    }, 200)

    return () => clearInterval(interval)
  }, [lineMode, lines, playing])

  return (
    <div className={`flex flex-col gap-2 ${compact ? '' : 'bg-surface rounded-2xl p-4'}`}>
      <audio
        ref={audioRef}
        src={src}
        onEnded={handleEnded}
        onCanPlay={() => setLoaded(true)}
        preload="auto"
      />

      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!loaded}
          className="w-11 h-11 rounded-full bg-gold flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg className="w-5 h-5 text-base fill-current" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-base fill-current ml-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Replay */}
        <button
          onClick={replay}
          className="w-9 h-9 rounded-full bg-elevated flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Replay"
        >
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>

        {/* Speed toggle */}
        <button
          onClick={toggleSpeed}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            speed === 0.75 ? 'bg-gold text-base' : 'bg-elevated text-text-secondary'
          }`}
        >
          {speed === 1 ? '1×' : '¾×'}
        </button>

        {/* Line mode toggle (only when lines provided) */}
        {lines && lines.length > 1 && (
          <button
            onClick={() => setLineMode(m => !m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              lineMode ? 'bg-gold text-base' : 'bg-elevated text-text-secondary'
            }`}
          >
            Line
          </button>
        )}

        {/* YouTube link */}
        <a
          href={youtubeUrl || YT_PLAYLIST}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto w-9 h-9 rounded-full bg-elevated flex items-center justify-center"
          aria-label="Listen on YouTube"
        >
          <svg className="w-4 h-4 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </a>
      </div>

      {/* Line-by-line display */}
      {lineMode && lines && lines.length > 0 && (
        <div className="mt-2 space-y-1">
          {lines.map((line, i) => (
            <p
              key={i}
              className={`font-devanagari text-base leading-relaxed transition-colors cursor-pointer px-2 py-1 rounded-lg ${
                activeLine === i ? 'text-gold bg-elevated' : 'text-text-secondary'
              }`}
              onClick={() => {
                const audio = audioRef.current
                if (!audio || !audio.duration) return
                const segDuration = audio.duration / lines.length
                audio.currentTime = i * segDuration
                audio.play().catch(() => {})
                setPlaying(true)
                setActiveLine(i)
              }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
