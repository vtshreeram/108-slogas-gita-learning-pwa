# Gita Sadhana — PWA Specification

## Problem Statement

Memorizing the 108 key Bhagavad Gita shlokas is difficult without a structured, distraction-free system. Existing tools are either passive (audio-only), scattered (separate apps for audio, flashcards, translation), or lack the discipline scaffolding needed for daily consistency. This app consolidates the full memorization loop — listen, repeat, understand, recall — into a single guided daily session with progress tracking, adaptive pacing, and spaced repetition.

---

## Data Sources

### Shloka Text & Translations
All shloka data sourced from the [`gita/gita`](https://github.com/gita/gita) repository (The Unlicense — public domain):
- `data/verse.json` — Sanskrit (Devanagari), IAST transliteration, word-by-word meanings
- `data/translation.json` — 7 English translators (Sivananda, Gambirananda, Purohit Swami, etc.) + 2 Hindi

The **canonical translation** used as default is **A.C. Bhaktivedanta Swami Prabhupada** (Bhagavad Gita As It Is, 1972 Macmillan Edition), sourced from [prabhupadagita.com](https://prabhupadagita.com/2012/10/17/108-imporant-slokas-from-the-1972-bhagavad-gita-as-it-is/). This is the translation used in the Bhakti-sastri Study Guide and is the primary memorization target.

### The 108 Shlokas (Definitive List)
Sourced from the Bhakti-sastri Study Guide as compiled by Atmatattva dasa (Bhaktivedanta Academy, Mayapur). These are the exact verses from the 1972 Macmillan Edition of Bhagavad Gita As It Is:

| # | Verse | # | Verse | # | Verse | # | Verse |
|---|-------|---|-------|---|-------|---|-------|
| 1 | 1.1 | 28 | 4.7 | 55 | 7.8 | 82 | 13.8-12 |
| 2 | 2.7 | 29 | 4.8 | 56 | 7.14 | 83 | 13.13 |
| 3 | 2.11 | 30 | 4.9 | 57 | 7.19 | 84 | 13.18 |
| 4 | 2.12 | 31 | 4.11 | 58 | 8.5 | 85 | 13.23 |
| 5 | 2.13 | 32 | 4.13 | 59 | 8.6 | 86 | 14.4 |
| 6 | 2.14 | 33 | 4.14 | 60 | 8.7 | 87 | 14.26 |
| 7 | 2.20 | 34 | 4.18 | 61 | 8.14 | 88 | 14.27 |
| 8 | 2.22 | 35 | 4.24 | 62 | 8.15 | 89 | 15.5 |
| 9 | 2.23 | 36 | 4.29-30 | 63 | 8.16 | 90 | 15.6 |
| 10 | 2.27 | 37 | 5.18 | 64 | 8.17 | 91 | 15.7 |
| 11 | 2.30 | 38 | 5.22 | 65 | 8.28 | 92 | 15.15 |
| 12 | 2.40 | 39 | 5.29 | 66 | 9.2 | 93 | 15.19 |
| 13 | 2.41 | 40 | 6.1 | 67 | 9.4 | 94 | 16.1-3 |
| 14 | 2.44 | 41 | 6.2 | 68 | 9.11 | 95 | 17.28 |
| 15 | 2.45 | 42 | 6.5 | 69 | 9.13 | 96 | 18.42 |
| 16 | 2.46 | 43 | 6.6 | 70 | 9.14 | 97 | 18.45 |
| 17 | 2.47 | 44 | 6.17 | 71 | 9.22 | 98 | 18.46 |
| 18 | 2.55-57 | 45 | 6.30 | 72 | 9.26 | 99 | 18.47 |
| 19 | 2.59 | 46 | 6.32 | 73 | 9.27 | 100 | 18.54 |
| 20 | 2.62 | 47 | 6.34 | 74 | 9.29 | 101 | 18.55 |
| 21 | 2.63 | 48 | 6.35 | 75 | 9.30 | 102 | 18.58 |
| 22 | 2.64 | 49 | 6.41 | 76 | 9.32 | 103 | 18.61 |
| 23 | 2.69 | 50 | 6.44 | 77 | 9.34 | 104 | 18.62 |
| 24 | 3.9 | 51 | 6.47 | 78 | 10.8 | 105 | 18.63 |
| 25 | 3.14 | 52 | 7.1 | 79 | 10.9 | 106 | 18.65 |
| 26 | 3.21 | 53 | 7.3 | 80 | 10.10 | 107 | 18.66 |
| 27 | 3.27 | 54 | 7.7 | 81 | 10.11 | 108 | 18.78 |

> Note: Some entries span multiple verses (e.g., 2.55-57, 4.29-30, 10.12-13, 13.8-12, 16.1-3). These are treated as single learning units. Total audio files needed: ~120 individual MP3s, merged into ~108 units.

### Audio Source
**Primary (bundled, offline)**: Public-domain MP3s from `gita/gita` repo (`data/verse_recitation/{chapter}/{verse}.mp3`), downloaded at build time and bundled into `public/audio/`. These enable full offline functionality.

**Supplementary (online)**: The user-provided YouTube playlist ([PLX0Ub3o9M5sIwlsm_qirzkwfDv2J7LHsV](https://www.youtube.com/watch?v=NcH9Iff4tYY&list=PLX0Ub3o9M5sIwlsm_qirzkwfDv2J7LHsV)) is surfaced in the app as a "Listen on YouTube" button for the full high-quality recitation experience. YouTube audio cannot be bundled directly due to ToS.

For multi-verse entries (e.g., 2.55-57), individual MP3s are concatenated at build time using `ffmpeg` into a single audio file.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v3 |
| PWA | `vite-plugin-pwa` (Workbox) |
| State | Zustand |
| Persistence | IndexedDB via `idb` |
| Audio | HTML5 Audio + Web Audio API (playback rate) |
| Notifications | Web Push API (VAPID) |
| SRS | Custom SM-2 implementation |
| Fonts | Noto Serif Devanagari (Sanskrit), Inter (UI) |

---

## UI Design — Vedabase-Inspired

The UI takes direct inspiration from [vedabase.io](https://vedabase.io/en/), the standard for Vaishnava scripture presentation online. The core principle: scripture content is the hero — chrome is minimal, typography is generous, and the reading experience is distraction-free.

### Verse Layout (vedabase.io pattern)

```
┌─────────────────────────────────────────────────┐
│  BG 2.47  ·  Karma Yoga          [▶ 1x]  [YT↗] │  ← breadcrumb + inline audio
├─────────────────────────────────────────────────┤
│                                                 │
│        कर्मण्येवाधिकारस्ते                      │  ← Sanskrit, large, centered
│        मा फलेषु कदाचन ।                         │     Noto Serif Devanagari
│        मा कर्मफलहेतुर्भूः                       │
│        मा ते सङ्गोऽस्त्वकर्मणि ॥               │
│                                                 │
├─────────────────────────────────────────────────┤
│  karmaṇy evādhikāras te                         │  ← IAST transliteration
│  mā phaleṣu kadācana ...                        │     italic, muted, toggleable
├─────────────────────────────────────────────────┤
│  SYNONYMS                                       │  ← section label: gold, caps
│  karmaṇi — in prescribed duties; eva —          │  ← inline word-meaning pairs
│  certainly; adhikāraḥ — right; te — of you...  │
├─────────────────────────────────────────────────┤
│  TRANSLATION                                    │  ← section label: gold, caps
│  You have a right to perform your prescribed    │  ← bold, prominent, warm white
│  duties, but you are not entitled to the        │
│  fruits of your actions...                      │
├─────────────────────────────────────────────────┤
│  Translator: [Prabhupada ▼]                     │  ← selector, bottom of card
└─────────────────────────────────────────────────┘
```

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0F0F0F` | App background |
| `bg-surface` | `#1C1C1E` | Cards, panels |
| `bg-elevated` | `#2C2C2E` | Hover states, dividers |
| `accent-gold` | `#C8922A` | Primary accent, section labels, CTAs |
| `accent-rust` | `#8B4513` | Secondary accent, hover |
| `text-primary` | `#F2EDE4` | Main text, Sanskrit |
| `text-secondary` | `#A8A29E` | Transliteration, metadata |
| `text-muted` | `#6B7280` | Disabled, placeholders |
| `success` | `#4ADE80` | Correct recall, streak |
| `error` | `#F87171` | Wrong recall, missed day |

### Typography

| Element | Font | Size | Weight | Style |
|---------|------|------|--------|-------|
| Sanskrit Devanagari | Noto Serif Devanagari | 1.75rem | 400 | Normal |
| IAST transliteration | Inter | 1rem | 400 | Italic |
| Section labels (SYNONYMS, TRANSLATION) | Inter | 0.7rem | 600 | Uppercase, letter-spaced, gold |
| Translation text | Inter | 1.05rem | 600 | Normal |
| Synonym pairs | Inter | 0.875rem | 400 | Normal |
| UI chrome | Inter | 0.875rem | 400–500 | Normal |

### Navigation
- **Top bar**: "Gita Sadhana" wordmark + current context (e.g., "BG 2.47 · Day 12")
- **Bottom tab bar** (5 tabs): Home · Session · Library · Progress · Settings
- Session screen: hides bottom bar, full-screen immersive mode
- Desktop: optional left sidebar with chapter list

---

## Core Concepts

### Session Flow (per shloka)

**Phase 1 — Listen**
- Audio plays automatically on phase entry
- Full Sanskrit text displayed (large, centered, Devanagari)
- Transliteration shown below (toggleable)
- Controls: play/pause, replay, speed toggle (1x / 0.75x), YouTube link
- User taps "Next →" when ready to proceed

**Phase 2 — Repeat**
- Audio plays line-by-line with 3-second pause gaps between lines
- Each line highlights in gold as it plays
- Transliteration shown for pronunciation aid
- User repeats aloud during the pause gap
- Tap any line to replay it individually
- User taps "Done Repeating" when ready

**Phase 3 — Understand**
- Full vedabase-style layout rendered:
  - Sanskrit text (large, centered)
  - Transliteration (italic, below, toggleable)
  - SYNONYMS: inline `word — meaning` pairs; tap any word to highlight it
  - TRANSLATION: full text in bold (default: Prabhupada)
  - Translator selector dropdown
- User reads at own pace, taps "I Understand" when ready

**Phase 4 — Recall** (mode determined by mastery level)
- **Level 0–1**: Multiple choice — 4 options, select the correct next line of the shloka
- **Level 2–3**: Fill-in-the-blank — type the missing word or short phrase
- **Level 4+**: Self-rate — audio plays the first line; user recites the rest mentally; rates memory 1–5
- After rating: brief feedback (correct/incorrect, next review date shown)
- SM-2 updates `ShlokaProgress` immediately

### SRS Algorithm (SM-2)

Each shloka tracks: `interval` (days), `easeFactor` (default 2.5), `repetitions`, `nextReviewDate`.

Quality score mapping:
- MCQ correct → 4; MCQ wrong → 1
- Fill-blank fully correct → 4; partial → 2; wrong → 1
- Self-rate 1–5 maps directly to SM-2 quality 0–5

### The 54-Day Journey

- Days 1–54: 2 new shlokas/day in list order
- Session content by selected duration:

| Duration | New Shlokas | Phases | SRS Reviews |
|----------|-------------|--------|-------------|
| 15 min (Lite) | 0 | Listen + Recall only | All due |
| 30 min | 1 | Full 4-phase | Due items |
| 60 min | 2 | Full 4-phase | Due items |

- After day 54: Maintenance mode — SRS-only sessions, streak continues

---

## Features

### 1. Home / Dashboard
- Today's session card: date, "Day X of 54", shlokas due
- Streak counter (flame icon + count)
- Progress ring: X of 108 shlokas learned
- Quick-start → duration picker (15 / 30 / 60 min) → session
- 18-chapter progress grid: each chapter as a tile, color-coded by % complete
- "Listen on YouTube" shortcut (opens playlist in new tab)

### 2. Daily Session Screen
- Full-screen immersive, bottom tab bar hidden
- Top breadcrumb: "BG 2.47 · Day 12 · Phase 3 of 4"
- Session progress bar (phases completed)
- Phase-driven flow per shloka: Listen → Repeat → Understand → Recall
- Audio player (inline): play/pause, replay, speed toggle, YouTube link
- Sanskrit display: large Devanagari, centered, warm white
- Transliteration: italic below, show/hide toggle (persists from Settings)
- Synonyms: inline word-meaning pairs (Understand phase only)
- Translation: bold paragraph + translator selector (Understand phase)
- Recall UI: adapts to mastery level
- Session summary screen on completion: shlokas covered, recall scores, streak update, next session preview

### 3. Progress Tracker
- 54-day calendar heatmap (green = done, red = missed, grey = future)
- Streak stats: current streak, longest streak
- Per-shloka mastery cards: verse ID, mastery level (0–5 stars), next review date
- Chapter breakdown: learned vs total per chapter (bar chart)
- Export progress as JSON
- Import progress from JSON

### 4. Shloka Library
- Grid of all 108 shlokas (card: verse ID, first Sanskrit line, mastery indicator)
- Filter chips: by chapter, by thematic tag, by mastery level
- Tap card → shloka detail view: full vedabase-style layout + audio player
- "Pin for extra review" toggle (adds to next session's SRS queue)
- "Listen on YouTube" link per shloka

### 5. Settings
- Default translator (dropdown, all available from dataset)
- Audio speed default (1x / 0.75x)
- Show transliteration by default (toggle)
- Daily reminder: enable + time picker (Web Push)
- Export / Import JSON
- Reset progress (with confirmation)
- About: data attribution, app version

### 6. Maintenance Mode (Post Day 54)
- Dashboard: "Maintenance Mode — Keeping the flame alive"
- Sessions: SRS-review-only, same Listen + Recall flow
- Streak continues uninterrupted
- Option to restart 54-day journey (mastery levels preserved)

---

## PWA Requirements

- **Manifest**: name "Gita Sadhana", short_name "Gita", `theme_color: #0F0F0F`, `background_color: #0F0F0F`, `display: standalone`, icons 192×192 and 512×512 (saffron Om/lotus on dark background)
- **Offline-first**: Workbox `generateSW` precaches all app assets + all 108 shloka MP3s on install
- **Web Push**: VAPID-based daily reminder; service worker handles notification display
- **Install prompt**: Custom "Add to Home Screen" banner shown after first completed session

---

## Data Model (IndexedDB)

### `shlokas` store (static, seeded on first load)
```typescript
interface Shloka {
  id: string;                    // "2.47" or "2.55-57"
  chapter: number;
  verse: number;                 // first verse number for ranges
  verseRange: string;            // "2.47" or "2.55-57"
  dayAssignment: number;         // 1–54
  thematicTag: string;
  sanskrit: string;
  transliteration: string;
  wordMeanings: { word: string; meaning: string }[];
  translations: { authorId: string; authorName: string; language: string; text: string }[];
  audioPath: string;             // "/audio/2/47.mp3"
}
```

### `progress` store
```typescript
interface ShlokaProgress {
  shlokaId: string;
  masteryLevel: number;          // 0–5
  interval: number;              // SRS days
  easeFactor: number;            // SM-2 (default 2.5)
  repetitions: number;
  nextReviewDate: string;        // ISO date
  lastReviewDate: string;
  recallHistory: { date: string; quality: number; mode: 'mcq' | 'fill' | 'self' }[];
}
```

### `sessions` store
```typescript
interface Session {
  id: string;
  date: string;                  // "YYYY-MM-DD"
  duration: 15 | 30 | 60;
  shlokasCovered: string[];
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
}
```

### `settings` store (single record)
```typescript
interface Settings {
  preferredTranslator: string;
  defaultSpeed: 'normal' | 'slow';
  showTransliteration: boolean;
  reminderEnabled: boolean;
  reminderTime: string | null;   // "07:00"
  currentDay: number;            // 1–54, or 55+ for maintenance
  streakCount: number;
  longestStreak: number;
  lastSessionDate: string | null;
  pushSubscription: string | null;
}
```

---

## Thematic Tags

| Tag | Representative Verses |
|-----|-----------------------|
| Dharma & Duty | 1.1, 2.7, 2.27, 2.30, 3.9 |
| Atman & Immortality | 2.11–2.30 |
| Karma Yoga | 2.40–2.47, 3.14, 3.21, 4.7–4.24 |
| Jnana Yoga | 4.29–4.30, 5.18, 5.22, 5.29 |
| Dhyana Yoga | 6.1–6.47 |
| Bhakti Yoga | 9.2–9.34, 10.8–10.11, 11.54–11.55, 12.5–12.10 |
| Vibhuti | 10.12–10.41 |
| Kshetra & Kshetrajna | 13.8–13.23 |
| Gunas | 14.4–14.27 |
| Purushottama | 15.5–15.19 |
| Daivi Svabhava | 16.1–16.3 |
| Moksha | 18.42–18.78 |

---

## Build-Time Data Pipeline

A Node.js script (`scripts/build-data.mjs`) runs before the Vite build:

1. Reads `gita/gita` `verse.json` and `translation.json` (downloaded to `scripts/data/` cache)
2. Filters to the 108 verse IDs defined in `scripts/shloka-manifest.json`
3. Parses `word_meanings` string (`"word—meaning; word—meaning"`) into `{ word, meaning }[]`
4. Joins all available translations per verse
5. Assigns `dayAssignment` (1–54) and `thematicTag` from manifest
6. Outputs `public/data/shlokas.json`

For multi-verse entries (e.g., 2.55-57):
- Concatenates Sanskrit, transliteration, and word meanings from constituent verses
- Merges audio: `ffmpeg -i 55.mp3 -i 56.mp3 -i 57.mp3 -filter_complex concat=n=3:v=0:a=1 output.mp3`
- Outputs single MP3 to `public/audio/{chapter}/{verseRange}.mp3`

---

## Acceptance Criteria

1. App installs as PWA on iOS Safari and Android Chrome with correct icons and name
2. All 108 shlokas load with Sanskrit, transliteration, word-by-word synonyms, and Prabhupada translation as default
3. All available translators from the dataset are selectable in Settings and per-session
4. Audio plays for all 108 shlokas at 1x and 0.75x; multi-verse entries play as single concatenated audio
5. All audio and app assets work fully offline after first load
6. Session duration picker (15/30/60 min) correctly determines content (lite/partial/full)
7. Recall phase shows MCQ for mastery 0–1, fill-blank for 2–3, self-rate for 4+
8. SM-2 correctly schedules next review after each recall rating
9. Streak increments on session completion and resets after a missed day
10. Progress exports to JSON and re-imports correctly, restoring all mastery data
11. Web Push notification fires at user-set time
12. After day 54, app enters maintenance mode with SRS-only sessions
13. Library filters by chapter, thematic tag, and mastery level work correctly
14. "Listen on YouTube" button opens the correct playlist URL
15. Vedabase-style verse layout renders: Sanskrit → transliteration → synonyms → translation

---

## Implementation Steps

1. **Project scaffold** — `npm create vite@latest gita-sadhana -- --template react-ts`; install Tailwind CSS v3, Zustand, `idb`, `vite-plugin-pwa`, Noto Serif Devanagari
2. **Shloka manifest** — `scripts/shloka-manifest.json`: 108 entries with verse ID, day assignment, thematic tag
3. **Data pipeline** — `scripts/build-data.mjs`: fetch/parse `gita/gita` JSON, filter 108 shlokas, parse word_meanings, join translations, output `public/data/shlokas.json`
4. **Audio assets** — Download 108 MP3s from `gita/gita` into `public/audio/`; `ffmpeg` concatenation for multi-verse entries; integrate into build script
5. **PWA config** — Configure `vite-plugin-pwa` with Workbox `generateSW`, precache all assets + audio; create `manifest.json` with icons
6. **IndexedDB layer** — Schema with `idb`; seed `shlokas` on first load; CRUD for `progress`, `sessions`, `settings`
7. **SRS engine** — `src/lib/srs.ts`: SM-2 `calculateNextReview(quality, progress)` → updated `ShlokaProgress`
8. **Audio player component** — `src/components/AudioPlayer.tsx`: play/pause, replay, speed toggle (1x/0.75x), line-by-line mode with pause gaps
9. **Verse display component** — `src/components/VerseDisplay.tsx`: vedabase-style layout — Sanskrit → transliteration toggle → synonyms grid → translation + translator selector
10. **Session engine** — `src/lib/session.ts`: state machine — config → queue builder (new + SRS due, within time budget) → phase sequencer → summary
11. **Recall components** — `src/components/recall/MCQ.tsx`, `FillBlank.tsx`, `SelfRate.tsx`; mastery-level gating in session engine
12. **Home / Dashboard** — Streak, progress ring, chapter grid, session start card with duration picker
13. **Session screen** — Full-screen layout, phase navigator, breadcrumb, audio player, verse display, recall components, session summary
14. **Library screen** — Shloka grid with filter chips, shloka detail modal
15. **Progress screen** — 54-day calendar heatmap, mastery grid, export/import JSON
16. **Settings screen** — Translator selector, speed default, transliteration toggle, reminder time picker, reset, export/import
17. **Web Push** — VAPID key generation; service worker notification handler; Settings UI
18. **Maintenance mode** — Post-day-54 state: dashboard copy, SRS-only session builder, restart option
19. **Polish** — Mobile-first responsive layout, loading skeletons, error boundaries, install prompt after first session
20. **Testing** — Manual test on iOS Safari and Android Chrome (PWA install, offline, audio); unit tests for SRS scheduling and session queue builder
