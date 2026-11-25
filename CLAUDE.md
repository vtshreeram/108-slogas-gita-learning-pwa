# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A PWA for memorizing 108 Bhagavad Gita shlokas through a 4-step learning loop: listen, repeat, understand, recall. Built as a single-page Next.js app with offline support via service worker. State lives in localStorage per user (optional Firestore sync, off by default).

## Commands

```bash
npm run dev          # Start dev server (Turbopack) at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npm run audio:fetch  # Fetch missing audio from YouTube via Python/yt-dlp
npm run audio:verify # Verify audio file integrity
npm run audio:fetch:all # Fetch per-verse audio for all 657 verses (links in requested-youtube-links-all.txt), then join verse ranges such as 1.16-18
node scripts/build-line-cues.mjs # Regenerate src/data/line-cues.json (built-in line timings; needs ffmpeg/ffprobe; rerun if public/audio/ changes)
node scripts/build-chapter-audio.mjs # Re-encode audio-src/ chapter masters to 64 kbps and rebuild src/data/chapter-audio.json
```

Run a single test file: `npx vitest run src/lib/server/__tests__/route.test.ts`

## Tech Stack

- **Next.js 15** (App Router, React 19, TypeScript 5, Turbopack)
- **Tailwind CSS 4** with **shadcn/ui** (New York style, Radix primitives)
- **Vitest** with Node environment (not jsdom)
- **Zod** for validation; **next-themes** for dark/light mode (no animation library: use CSS)
- Path alias: `@/*` maps to `./src/*`

## Architecture

### State Management
`src/lib/learning-progress.ts` is the Learning progress module: pure state, schema/migration, transitions, streak/recall rules and derived stats (unit-tested in node). `useShlokaState(uid)` (`src/hooks/use-shloka-state.ts`) is a thin React wrapper. Progress is stored **per user id** in localStorage (`gita-learning-state-v4:<uid>`, via `src/lib/progress-store.ts`); the first account on a device adopts the legacy shared key once. Browsing edits (position, content tab) are "quiet": saved locally but never bump `updatedAt`.

Optional cloud sync (`src/lib/progress-sync.ts`, Firestore adapter in `src/lib/firestore-remote.ts`) is off unless `NEXT_PUBLIC_PROGRESS_SYNC=1` (build-time). Rules: first sync on a device merges, afterwards newest-`updatedAt` wins. Rules file: `firestore.rules`. Audio loop policy is pure in `src/lib/audio-playback.ts`.

### Shared UI
Inner screens (profile, chapter list, player) use `PageHeader` (back arrow, centred title, optional action; clears the status bar). Loading states use `AppLoader` (the ॐ mark breathing slowly, in the server HTML so there is no blank first screen; a "still loading" hint after 8 s). `theme-color` follows the theme (`src/lib/theme-colors.ts`, synced by `ThemeColor` when the theme is chosen in Profile) so Android status/navigation bars match the page; the manifest splash is dark. App icons are generated from the ॐ glyph by `node scripts/build-icons.mjs` (set `CHROMIUM_PATH` if the Playwright browser is not installed). Hover styles are only applied under `@media (hover: hover)` so taps don't leave highlights on touch screens.

### Main Page (`src/app/page.tsx`)
Single-page app. Composes `ShlokaCard` (content display with swipe navigation and 4 progress pills) and `AudioPlayer` (fixed bottom bar with loop modes and iOS autoplay handling). Keyboard arrow keys and touch swipes navigate between shlokas.

### Data Layer (`src/lib/shlokas.ts`)
108 shloka objects with: id (GS-001..GS-108), chapter/verse reference, Sanskrit (Devanagari, search only), transliteration, English translation, audio path, and reflection prompt. Audio files live in `public/audio/` as `<chapter>.<verse>.mp3` (64 kbps mono, re-encoded from the originals, which are kept in gitignored `audio-src/verses-original/`; durations match so saved line cues still line up).

### Lazy data loading
The picker, go-to box, previous/next and the purport button read `src/data/verse-index.json` (via `src/lib/verse-index.ts`): a 7 KB reference-only index of all 657 verses with purport availability. Regenerate it with `node scripts/build-verse-index.mjs` after editing `src/data/`; a unit test fails when it is stale. Chapter text and purports download only when a verse/purport is opened, through `createChapterLoader` in `src/lib/gita-verses.ts` (de-duplicated, 3 at a time, failures retry). The service worker precaches only the app shell; chapters and purports a learner has opened are saved in `gita-chapters-v1` and work offline. The line-practice, verse-study and offline-download tools are a separate chunk loaded on first open and prefetched at idle once the worker controls the page (so they are also cached offline).

### API Routes
The data routes are the static `/api/chapters/[chapter]` and `/api/purports/[chapter]` endpoints. Two dynamic routes support operations: `/api/health` (uptime check) and `/api/client-errors` (POST, crash reports; see below). Server helpers in `src/lib/server/` provide `routeHandler()` wrapper, JSON envelope helpers (`jsonOk`/`jsonError`), and Zod validation utilities. Tests cover these server utilities.

### Error reporting and incidents
Crashes are reported to the app's own `/api/client-errors` route and logged as one JSON line each (search Vercel logs for `client_error`). Pure rules (bounding, noise filter, de-dupe, 5 per page load, pathname only, no user data) are in `src/lib/error-report.ts`; browser glue in `src/lib/report-error.ts` (production only); listeners in `src/components/error-reporter.tsx`; `error.tsx`, `global-error.tsx` and `AudioErrorBoundary` report too. Emergency: building with `SW_KILL_SWITCH=1` ships `scripts/service-worker-kill.js`, which clears the app-shell cache and unregisters itself (keeps downloads and progress). Steps are in `docs/incident-runbook.md`.

### Chapter audio (`/chapters`)
"All Chapter Audios": full-screen player + chapter list (`src/components/chapter-audios.tsx`, pure rules incl. sleep timer in `src/lib/chapter-audio.ts`, durations in `src/data/chapter-audio.json`). Playback lives in `ChapterAudioProvider` (`src/components/chapter-audio-provider.tsx`, mounted in the root layout), so a chapter keeps playing across screens; other screens show `ChapterMiniPlayer` once a chapter was started. Internal links use `next/link` (offline, Next falls back to a document load the service worker serves). Only one recording plays at a time: `src/lib/audio-focus.ts` hands the speaker and Lock Screen controls between the chapter and verse players. Resume positions are per user in localStorage (`gita-chapter-audio-v1:<uid>`). Under the full-screen player, `ChapterBriefPanel` (`src/components/chapter-brief.tsx`, reached by the Brief button, or from the list via the info button on each row, which opens it in a dialog without changing playback) shows an English/Tamil overview, quick read, key verses (★ 108 verses open the learning loop) and action points; the text lives in `docs/chapter-briefs.md`, and `node scripts/build-chapter-briefs.mjs` regenerates `src/data/chapter-briefs.json` (lazy-loaded; a unit test fails when it is stale). The 18 files (64 kbps mono, ~400 MB) are **not in git**: they live in the Cloudflare R2 bucket `bhagavad-gita-audio` behind `https://108-imp-slogas-audio.peacockindia.in` and are selected by `NEXT_PUBLIC_CHAPTER_AUDIO_BASE` (build-time; set in Vercel, falls back to `/chapter-audio` in dev). Masters live in gitignored `audio-src/`; encoded copies in gitignored `public/chapter-audio/`. The service worker only handles same-origin `/audio/`, so chapter audio streams and is not available offline.

### PWA
Service worker (`public/sw.js`) caches shell assets and serves audio cache-first when a verse was downloaded for offline use, otherwise streams it from the network. Manifest at `public/manifest.webmanifest`. App is installable with offline fallback.

### Content Modes
Three display modes toggled at runtime (`CONTENT_TABS` in `src/lib/constants.ts`): transliteration (Roman), English (with translation author) and Tamil. A saved legacy `sanskrit` mode is migrated to Tamil. The Devanagari text exists in the data and is used for search only; it is not displayed.

## Build Notes

- The build type-checks and lints (no `ignoreBuildErrors`); keep `npx tsc --noEmit` and `npm run lint` clean
- Package manager is **pnpm** (`pnpm-lock.yaml`); add or remove packages with `pnpm`, never `npm`, or the Vercel frozen install fails
- `src/components/ui/` holds only what the app imports (`dialog.tsx`). Add shadcn components when needed rather than keeping unused ones
- `/api/chapters/[chapter]` and `/api/purports/[chapter]` are static (`generateStaticParams`, chapters 1-18)
- `next.config.ts` sends a `Content-Security-Policy-Report-Only` header (violations only log to the console). Add new third-party origins to it, and switch it to enforcing once a release runs clean
- Audio fetch script is Python (`scripts/fetch_audio_from_links.py`, links in `requested-youtube-links.txt`); it uses the `yt_dlp` module or a `yt-dlp` binary on PATH and system ffmpeg, and writes 64 kbps mono like the rest of `public/audio`. Every one of the 657 verses has a recording (`<reference>.mp3`, ranges such as `1.16-18` joined from per-verse files); the bottom audio player shows on every verse, while line practice, study tools and offline downloads stay with the 108. A unit test fails if a verse has no file
