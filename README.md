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

The default development command uses Webpack on Next.js 15 for reliable hot reloads.
Turbopack remains available with `pnpm dev:turbo`. If an old tab reports a missing
module factory after a server restart, reload the page to discard its previous runtime.

Run one development server per checkout. Development uses `.next/`; `npm run build`
and `npm start` use `.next-build/`, so a production build can run without overwriting
the development server's generated files.

## PWA

- Manifest: `/public/manifest.webmanifest`
- Service Worker: `/public/sw.js`
- Installable in supported browsers (standalone display mode)

## Notes

- The 108-verse dataset includes Sanskrit, Roman transliteration, English and Tamil meanings (from the Tamil edition of Bhagavad-gītā As It Is, with edited Bharati fallbacks) with source credits. An "All verses" view browses and searches all 657 entries, with the 108 tinted.
- Daily completions, scheduled revision, offline audio downloads, calibrated line practice and full backups are described in [Learning tools](docs/learning-tools.md).
- Tamil pronunciation aids and edited translations still need independent expert review; the [108-entry checklist](docs/editorial-review.md) records that work explicitly.

## Checks

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec playwright install chromium
pnpm start --port 3002
# In another terminal:
pnpm test:browser
```

The browser check uses an isolated mocked login and blocks Firestore access. Screenshots
are saved under `test-results/`. The production build generates the release-specific
offline worker automatically.
