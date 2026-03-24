# Gita 108 Memorization PWA

A personal PWA-based learning system to memorize 108 key Bhagavad Gita shlokas through a structured, distraction-free routine.

## Core Flow

- Closed-loop learning: `listen -> repeat -> understand -> recall`
- 54-day journey: `2 shlokas/day`
- Adaptive pacing: auto-fills next pending verses
- Lite mode fallback: `1 shloka/day` when schedule is tight
- Progress visibility: day number, mastered count, streak estimate, recall rate
- Revision cycle: periodic revisit cards for recent mastered verses

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## PWA

- Manifest: `/public/manifest.webmanifest`
- Service Worker: `/public/sw.js`
- Installable in supported browsers (standalone display mode)

## Notes

- Shloka dataset currently uses structured placeholders for transliteration/meaning fields.
- You can replace `src/lib/shlokas.ts` with your exact curated 108-shloka list without changing app logic.
