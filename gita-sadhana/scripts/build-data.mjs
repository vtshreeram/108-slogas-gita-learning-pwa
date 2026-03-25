#!/usr/bin/env node
/**
 * Data pipeline: fetches gita/gita JSON, filters to 108 shlokas,
 * parses word_meanings, joins translations, outputs public/data/shlokas.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE_DIR = join(__dirname, 'data')
const OUTPUT_DIR = join(ROOT, 'public', 'data')

const GITA_BASE = 'https://raw.githubusercontent.com/gita/gita/main/data'

async function fetchOrCache(filename) {
  const cachePath = join(CACHE_DIR, filename)
  if (existsSync(cachePath)) {
    console.log(`  Using cached ${filename}`)
    return JSON.parse(readFileSync(cachePath, 'utf8'))
  }
  console.log(`  Fetching ${filename} from gita/gita...`)
  const res = await fetch(`${GITA_BASE}/${filename}`)
  if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`)
  const data = await res.json()
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(cachePath, JSON.stringify(data, null, 2))
  return data
}

function parseWordMeanings(raw) {
  if (!raw) return []
  // Format: "word1—meaning1; word2—meaning2; ..."
  return raw.split(';').map(pair => {
    const dashIdx = pair.indexOf('—')
    if (dashIdx === -1) return null
    return {
      word: pair.slice(0, dashIdx).trim(),
      meaning: pair.slice(dashIdx + 1).trim(),
    }
  }).filter(Boolean)
}

async function main() {
  console.log('Building shloka data...')

  const manifest = JSON.parse(readFileSync(join(__dirname, 'shloka-manifest.json'), 'utf8'))
  const verses = await fetchOrCache('verse.json')
  const translations = await fetchOrCache('translation.json')
  const authors = await fetchOrCache('authors.json')

  // Build lookup maps
  const verseMap = {}
  for (const v of verses) {
    verseMap[`${v.chapter_number}.${v.verse_number}`] = v
  }

  // Group translations by verse_id
  const translationMap = {}
  for (const t of translations) {
    if (!translationMap[t.verse_id]) translationMap[t.verse_id] = []
    translationMap[t.verse_id].push(t)
  }

  // Author id -> name map
  const authorMap = {}
  for (const a of authors) {
    authorMap[a.id] = a.name
  }

  const shlokas = []

  for (const entry of manifest) {
    const { id, day, tag } = entry
    const [chapterStr, verseStr] = id.split('.')
    const chapter = parseInt(chapterStr)

    // Determine which verse numbers to include
    let verseNums
    if (entry.verses) {
      verseNums = entry.verses
    } else {
      // Handle range like "2.55-57"
      if (verseStr.includes('-')) {
        const [start, end] = verseStr.split('-').map(Number)
        verseNums = Array.from({ length: end - start + 1 }, (_, i) => start + i)
      } else {
        verseNums = [parseInt(verseStr)]
      }
    }

    const firstVerseNum = verseNums[0]
    const verseObjects = verseNums.map(n => verseMap[`${chapter}.${n}`]).filter(Boolean)

    if (verseObjects.length === 0) {
      console.warn(`  WARNING: No verse data found for ${id}`)
      continue
    }

    // Merge text for multi-verse entries
    const sanskrit = verseObjects.map(v => v.text).join('\n\n')
    const transliteration = verseObjects.map(v => v.transliteration).join('\n')
    const wordMeanings = verseObjects.flatMap(v => parseWordMeanings(v.word_meanings))

    // Collect all translations for the first verse (representative)
    const firstVerse = verseObjects[0]
    const verseTrans = translationMap[firstVerse.id] || []
    const translationList = verseTrans.map(t => ({
      authorId: String(t.author_id),
      authorName: authorMap[t.author_id] || `Author ${t.author_id}`,
      language: t.language_id === 1 ? 'en' : t.language_id === 2 ? 'hi' : 'other',
      text: t.description,
    }))

    // Audio path: for multi-verse, we'll use the first verse's path
    // (ffmpeg concat handled separately for multi-verse)
    const audioPath = `/audio/${chapter}/${verseNums.join('-')}.mp3`

    shlokas.push({
      id,
      chapter,
      verse: firstVerseNum,
      verseRange: id,
      dayAssignment: day,
      thematicTag: tag,
      sanskrit,
      transliteration,
      wordMeanings,
      translations: translationList,
      audioPath,
    })
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(join(OUTPUT_DIR, 'shlokas.json'), JSON.stringify(shlokas, null, 2))
  console.log(`✓ Written ${shlokas.length} shlokas to public/data/shlokas.json`)
}

main().catch(err => {
  console.error('Build failed:', err)
  process.exit(1)
})
