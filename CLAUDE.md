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
```

Run a single test file: `npx vitest run src/lib/server/__tests__/route.test.ts`

## Tech Stack

- **Next.js 15** (App Router, React 19, TypeScript 5, Turbopack)
- **Tailwind CSS 4** with **shadcn/ui** (New York style, Radix primitives)
- **Vitest** with Node environment (not jsdom)
- **Zod** for validation; **Framer Motion** for animations; **next-themes** for dark/light mode
- Path alias: `@/*` maps to `./src/*`

## Architecture

### State Management
`src/lib/learning-progress.ts` is the Learning progress module: pure state, schema/migration, transitions, streak/recall rules and derived stats (unit-tested in node). `useShlokaState(uid)` (`src/hooks/use-shloka-state.ts`) is a thin React wrapper. Progress is stored **per user id** in localStorage (`gita-learning-state-v4:<uid>`, via `src/lib/progress-store.ts`); the first account on a device adopts the legacy shared key once. Browsing edits (position, content tab) are "quiet": saved locally but never bump `updatedAt`.

Optional cloud sync (`src/lib/progress-sync.ts`, Firestore adapter in `src/lib/firestore-remote.ts`) is off unless `NEXT_PUBLIC_PROGRESS_SYNC=1` (build-time). Rules: first sync on a device merges, afterwards newest-`updatedAt` wins. Rules file: `firestore.rules`. Audio loop policy is pure in `src/lib/audio-playback.ts`.

### Main Page (`src/app/page.tsx`)
Single-page app. Composes `ShlokaCard` (content display with swipe navigation and 4 progress pills) and `AudioPlayer` (fixed bottom bar with loop modes and iOS autoplay handling). Keyboard arrow keys and touch swipes navigate between shlokas.

### Data Layer (`src/lib/shlokas.ts`)
108 shloka objects with: id (GS-001..GS-108), chapter/verse reference, Sanskrit (Devanagari), transliteration, English translation, audio path, and reflection prompt. Audio files live in `public/audio/` as `<chapter>.<verse>.mp3`.

### API Routes
Minimal demo endpoints at `/api/echo` and `/api/status`. Server helpers in `src/lib/server/` provide `routeHandler()` wrapper, JSON envelope helpers (`jsonOk`/`jsonError`), and Zod validation utilities. Tests cover these server utilities.

### PWA
Service worker (`public/sw.js`) caches shell assets and uses network-first for audio. Manifest at `public/manifest.webmanifest`. App is installable with offline fallback.

### Content Modes
Three display modes toggled at runtime: transliteration (Roman), English (with translation author), Sanskrit (Devanagari via Noto Sans Devanagari font).

## Build Notes

- `next.config.ts` has `ignoreBuildErrors` and `ignoreDuringBuilds` set to true for TS/ESLint
- shadcn/ui components are in `src/components/ui/` — many are pre-generated and unused
- Audio fetch script is Python (`scripts/fetch_audio_from_links.py`) requiring yt-dlp
