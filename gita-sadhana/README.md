# Gita Sadhana

A personal PWA for memorizing 108 key Bhagavad Gita shlokas through a structured daily practice.

## What it does

Built around a 1-hour daily routine using a closed-loop approach: **Listen → Repeat → Understand → Recall**. Progress is tracked through a 54-day journey (2 shlokas/day) with streaks, spaced repetition (SM-2), and revision cycles.

- **108 shlokas** from the Bhakti-sastri Study Guide (Bhaktivedanta Academy, Mayapur)
- **Adaptive sessions**: 15 min (reviews only), 30 min (1 new + reviews), 60 min (2 new + reviews)
- **Progressive recall**: MCQ → fill-in-the-blank → self-rated full recall as mastery grows
- **Offline-first**: all assets and audio cached via Workbox service worker
- **Vedabase-inspired UI**: dark theme, saffron/gold palette, Devanagari-first layout

## Setup

```bash
# Install dependencies
npm install

# Fetch shloka data and download audio (run once)
npm run data:setup

# Start dev server
npm run dev

# Production build
npm run build
```

## Data sources

- Shloka text, transliteration, word meanings, translations: [`gita/gita`](https://github.com/gita/gita) (The Unlicense)
- Default translation: A.C. Bhaktivedanta Swami Prabhupada, *Bhagavad Gita As It Is* (1972 Macmillan Edition)
- Audio: `gita/gita` verse recitations (public domain)
- YouTube playlist: [PLX0Ub3o9M5sIwlsm_qirzkwfDv2J7LHsV](https://www.youtube.com/watch?v=NcH9Iff4tYY&list=PLX0Ub3o9M5sIwlsm_qirzkwfDv2J7LHsV)

## Project structure

```
gita-sadhana/
├── public/
│   ├── audio/          # MP3s per verse (downloaded via npm run data:audio)
│   ├── data/           # shlokas.json (generated via npm run data:build)
│   └── icons/          # PWA icons
├── scripts/
│   ├── shloka-manifest.json   # 108 verse IDs, day assignments, thematic tags
│   ├── build-data.mjs         # Fetches gita/gita JSON, outputs shlokas.json
│   └── download-audio.mjs     # Downloads MP3s from gita/gita repo
└── src/
    ├── components/     # AudioPlayer, VerseDisplay, recall components (MCQ/FillBlank/SelfRate)
    ├── lib/            # db.ts (IndexedDB), srs.ts (SM-2), session.ts, notifications.ts
    ├── screens/        # Home, Session, Library, Progress, Settings
    ├── store/          # Zustand store
    └── types/          # TypeScript interfaces
```
