#!/usr/bin/env node
/**
 * Downloads MP3 audio files for the 108 shlokas from gita/gita repo.
 * For multi-verse entries, downloads individual files (ffmpeg concat is optional).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const AUDIO_DIR = join(ROOT, 'public', 'audio')
const GITA_AUDIO_BASE = 'https://raw.githubusercontent.com/gita/gita/main/data/verse_recitation'

const manifest = JSON.parse(readFileSync(join(__dirname, 'shloka-manifest.json'), 'utf8'))

async function downloadFile(url, dest) {
  if (existsSync(dest)) return false // already downloaded
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  SKIP ${url} (${res.status})`)
    return false
  }
  const buf = await res.arrayBuffer()
  writeFileSync(dest, Buffer.from(buf))
  return true
}

async function main() {
  console.log('Downloading audio files...')
  let downloaded = 0
  let skipped = 0

  for (const entry of manifest) {
    const { id } = entry
    const [chapterStr, verseStr] = id.split('.')
    const chapter = parseInt(chapterStr)

    let verseNums
    if (entry.verses) {
      verseNums = entry.verses
    } else if (verseStr.includes('-')) {
      const [start, end] = verseStr.split('-').map(Number)
      verseNums = Array.from({ length: end - start + 1 }, (_, i) => start + i)
    } else {
      verseNums = [parseInt(verseStr)]
    }

    const chapterDir = join(AUDIO_DIR, String(chapter))
    mkdirSync(chapterDir, { recursive: true })

    const destFilename = `${verseNums.join('-')}.mp3`
    const destPath = join(chapterDir, destFilename)

    if (verseNums.length === 1) {
      // Single verse — download directly
      const url = `${GITA_AUDIO_BASE}/${chapter}/${verseNums[0]}.mp3`
      const ok = await downloadFile(url, destPath)
      if (ok) { downloaded++; console.log(`  ✓ ${id}`) }
      else skipped++
    } else {
      // Multi-verse — download each individually, then use first as placeholder
      // (proper concat requires ffmpeg; for now use first verse audio)
      const firstVerse = verseNums[0]
      const url = `${GITA_AUDIO_BASE}/${chapter}/${firstVerse}.mp3`
      const ok = await downloadFile(url, destPath)
      if (ok) { downloaded++; console.log(`  ✓ ${id} (first verse audio, concat pending)`) }
      else skipped++

      // Also download individual files for potential ffmpeg concat
      for (const vn of verseNums) {
        const indivPath = join(chapterDir, `${vn}.mp3`)
        await downloadFile(`${GITA_AUDIO_BASE}/${chapter}/${vn}.mp3`, indivPath)
      }
    }
  }

  console.log(`\nDone: ${downloaded} downloaded, ${skipped} already existed`)
}

main().catch(err => {
  console.error('Audio download failed:', err)
  process.exit(1)
})
