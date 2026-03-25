# AGENTS.md — Gita 108 Memorization PWA

Agent guidance for working in this repository.

---

## Project Overview

A Next.js 15 PWA for memorizing 108 Bhagavad Gita shlokas over 54 days.
The learning loop is: **listen → repeat → understand → recall**.
All state is persisted in `localStorage` (key: `gita-learning-state-v3`).
No backend, no auth, no database.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI primitives | Radix UI + shadcn/ui (`components.json`) |
| Animation | Framer Motion |
| Package manager | Bun (`bun.lock` present — use `bun` not `npm`) |
| PWA | Manual service worker (`public/sw.js`) + web manifest |
| Audio | Static MP3 files in `public/audio/<chapter.verse>.mp3` |

---

## Repository Layout

```
src/
  app/
    page.tsx          # Entire app UI — single-page, ~783 lines
    layout.tsx        # Root layout, metadata, SW registration
    globals.css       # Tailwind base + custom tokens
  lib/
    shlokas.ts        # 108-shloka dataset + exported constants
    utils.ts          # cn() helper only
  components/ui/      # shadcn/ui generated components (do not hand-edit)
  hooks/
    use-mobile.ts     # Breakpoint hook

public/
  audio/              # 106 MP3 files (2 shlokas have no audio yet)
  sw.js               # Service worker (cache-first strategy)
  manifest.webmanifest

scripts/
  fetch_audio_from_links.py   # yt-dlp wrapper; reads requested-youtube-links.txt
```

---

## Key Constants (`src/lib/shlokas.ts`)

```ts
DAILY_TARGET = 2        // shlokas per day (normal mode)
JOURNEY_DAYS = 54       // TOTAL_SHLOKAS / DAILY_TARGET
TOTAL_SHLOKAS = 108
```

Lite mode (1 shloka/day) is toggled in `AppState.activeMode`.

---

## Development Commands

```bash
bun install          # install dependencies
bun dev              # start dev server (Turbopack) on :3000
bun build            # production build
bun lint             # ESLint

# Audio tooling (requires yt-dlp + imageio-ffmpeg)
bun run audio:fetch  # download missing audio files
bun run audio:verify # check all expected MP3s exist
```

---

## State Shape

`AppState` (stored in `localStorage`):

```ts
{
  startedAt: string;          // ISO date of first use
  lastActiveDate: string;     // ISO date, updated on load
  activeMode: "normal" | "lite";
  completed: Record<shlokaId, Record<LoopStep, boolean>>;
  recallWins: number;
  recallAttempts: number;
  activeIndex: number;        // index into SHLOKAS array
  contentMode: "transliteration" | "english" | "sanskrit";
  expandedText: boolean;
}
```

Storage key versioning: bump `STORAGE_KEY` constant in `page.tsx` when the shape changes in a breaking way.

---

## Shloka Data

- Source: `src/lib/shlokas.ts` — a static TypeScript array, not fetched at runtime.
- 106 of 108 shlokas have `audioSrc` pointing to `/audio/<ref>.mp3`.
- All `reflectionPrompt` values are currently identical placeholders — they are intentionally generic and can be replaced per-shloka.
- To add/replace shlokas: edit `src/lib/shlokas.ts` only. No other file needs changing.

---

## PWA Notes

- Service worker uses a **cache-first** strategy. Audio files are cached on first fetch.
- Cache name is `gita-learning-v1` — bump this string in `public/sw.js` when deploying breaking asset changes.
- Manifest icon is SVG only (`/icon.svg`). PNG icons at 192×192 and 512×512 are missing (affects installability on some platforms).

---

## Constraints & Conventions

- **No tests exist.** Do not add a test framework without explicit instruction.
- `next.config.ts` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`. Fix type errors properly rather than relying on these flags.
- `orchids-visual-edits` is a visual editing integration — do not remove it.
- `src/components/ui/` is shadcn/ui generated output. Add new components via `bunx shadcn add <component>`, not by hand.
- All business logic lives in `src/app/page.tsx`. When it grows further, extract into `src/lib/` or `src/hooks/` rather than adding more files to `src/app/`.
- Commit messages in this repo are informal. Match the existing style.

---

## Audio File Naming

Files must be named `<chapter>.<verse>.mp3` (e.g., `2.47.mp3`).
The `audioSrc` field in `shlokas.ts` must match exactly: `/audio/<chapter>.<verse>.mp3`.
