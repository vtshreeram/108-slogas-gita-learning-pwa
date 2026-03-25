# AGENTS-IMPROVEMENT-SPEC.md

Concrete improvements identified after auditing the codebase and the newly created `AGENTS.md`.

---

## Audit Summary

### What's good

- README is accurate and concise.
- `src/lib/shlokas.ts` is the single source of truth for data — clean separation.
- `AppState` shape is well-typed; localStorage hydration is defensive (fallbacks on every field).
- Service worker is minimal and correct for a static PWA.
- Audio tooling (`scripts/fetch_audio_from_links.py`) is self-contained and well-documented.
- `.gitignore` covers all standard Next.js artifacts.
- `bun.lock` is committed — reproducible installs.

### What's missing

1. **AGENTS.md** — did not exist (now created).
2. **No tests** — zero test files, no test runner configured.
3. **PWA icons** — only an SVG icon; PNG icons at 192×192 and 512×512 are absent, breaking installability on Android Chrome and some iOS browsers.
4. **Two missing audio files** — `missing-audio-108.txt` documents 2 shlokas without MP3s; the app silently falls back to "unavailable" state.
5. **No CI** — no GitHub Actions workflow; lint and build are never verified automatically.
6. **`devcontainer.json` has no `postCreateCommand`** — developers must manually run `bun install` after container creation.
7. **No environment variable documentation** — the project has none currently, but there is no `.env.example` or note in AGENTS.md to guide future additions.

### What's wrong

1. **`next.config.ts` suppresses all TypeScript and ESLint errors at build time** (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`). This masks real bugs silently.
2. **`src/app/page.tsx` is 783 lines** — the entire application (state, audio logic, UI, sub-components) is in one file. This makes targeted edits risky and context windows expensive for agents.
3. **All 108 `reflectionPrompt` values are identical placeholders** — the field exists in the type and is rendered in the UI, but carries no per-shloka value.
4. **`package.json` `name` field is `"nextjs-new"`** — a scaffolding default, not the actual project name.
5. **Service worker cache name is `gita-learning-v1`** — hardcoded with no process to bump it on deploy; stale caches will serve old assets after updates.
6. **`public/audio/` contains 106 files but the dataset has 108 shlokas** — the gap is tracked in `missing-audio-108.txt` but not surfaced to the user or blocked in CI.

---

## Improvement Spec

Each item below is self-contained and independently actionable.

---

### SPEC-01 — Fix `package.json` name

**File:** `package.json`  
**Change:** Set `"name"` to `"gita-108-memorization-pwa"`.  
**Why:** Scaffolding default leaks into npm scripts output and error messages.

---

### SPEC-02 — Enable TypeScript and ESLint checks at build time

**File:** `next.config.ts`  
**Change:** Remove (or set to `false`) `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`.  
**Why:** These flags hide real type errors and lint violations. The codebase is small enough that fixing the underlying issues is preferable to suppressing them.  
**Prerequisite:** Run `bun lint` and `bun build` first to surface any existing errors, then fix them before removing the flags.

---

### SPEC-03 — Add `postCreateCommand` to devcontainer

**File:** `.devcontainer/devcontainer.json`  
**Change:** Add `"postCreateCommand": "bun install"`.  
**Why:** Without it, a freshly created container has no `node_modules` and `bun dev` fails immediately.

```json
{
  "name": "Gita 108 PWA",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:22",
  "postCreateCommand": "bun install"
}
```

Also consider switching from the 10 GB universal image to `mcr.microsoft.com/devcontainers/javascript-node:22` for faster container startup.

---

### SPEC-04 — Split `page.tsx` into focused modules

**Current state:** `src/app/page.tsx` is 783 lines containing state types, localStorage logic, audio control, day/progress calculations, and all UI sub-components.

**Target structure:**

```
src/
  lib/
    state.ts          # AppState type, STORAGE_KEY, load/save helpers
    progress.ts       # todayIso, daysBetween, fullDone, schedule helpers
  hooks/
    use-app-state.ts  # useState + localStorage effects
    use-audio.ts      # audioRef, audioState, play/pause/seek logic
  components/
    StatCard.tsx      # <StatCard label value Icon />
    LoopStepRow.tsx   # single step row with checkbox
    ShlokaCard.tsx    # shloka text display (sanskrit/transliteration/english)
    AudioPlayer.tsx   # play/pause/seek/loop controls
  app/
    page.tsx          # orchestration only, ~100 lines
```

**Why:** Agents operating on a 783-line file must load the entire file into context for any change. Splitting by concern reduces context cost, makes diffs reviewable, and isolates audio bugs from UI bugs.

**Approach:** Extract one module at a time, verify `bun dev` still works after each extraction.

---

### SPEC-05 — Add PNG icons for PWA installability

**Files to create:** `public/icon-192.png`, `public/icon-512.png`  
**File to update:** `public/manifest.webmanifest`

**Change to manifest:**
```json
"icons": [
  { "src": "/icon.svg",     "sizes": "any",     "type": "image/svg+xml", "purpose": "any" },
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png",     "purpose": "any maskable" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png",     "purpose": "any maskable" }
]
```

**Why:** Android Chrome requires a PNG icon ≥192×192 to show the "Add to Home Screen" prompt. The current SVG-only manifest fails this check.

**How to generate:** Export from `public/icon.svg` using Inkscape, ImageMagick, or any SVG-to-PNG tool at the two required sizes.

---

### SPEC-06 — Version the service worker cache on deploy

**File:** `public/sw.js`  
**Change:** Replace the hardcoded `"gita-learning-v1"` with a build-time injected version, or document a manual bump process.

**Option A (simple):** Add a comment in `sw.js` and `AGENTS.md` stating: "Bump `CACHE_NAME` to `gita-learning-v<N+1>` before each production deploy."

**Option B (automated):** Use `next.config.ts` to copy and template `sw.js` during build, injecting `process.env.npm_package_version` or a build timestamp.

**Why:** Without a cache bump, users who have the PWA installed will continue serving stale JS/CSS after a deploy until the browser's SW update cycle fires (up to 24 hours).

---

### SPEC-07 — Surface missing audio in the UI

**Current state:** 2 shlokas have no audio file. The app sets `audioState = "unavailable"` silently.

**Change:** In the shloka card, when `audioState === "unavailable"`, render a visible indicator (e.g., a muted speaker icon with tooltip "Audio not yet available for this verse") instead of showing the audio controls in a broken state.

**File:** `src/app/page.tsx` (or `AudioPlayer.tsx` after SPEC-04).

---

### SPEC-08 — Add per-shloka reflection prompts

**File:** `src/lib/shlokas.ts`  
**Current state:** All 108 entries share the same `reflectionPrompt`: `"Summarize this teaching in your own words and apply it once today."`

**Change:** Replace with verse-specific prompts that relate to the actual teaching of each shloka.

**Why:** The `reflectionPrompt` field is rendered during the "understand" step. A generic prompt reduces the value of that step.

**Approach:** This is content work, not code work. Can be done incrementally — update 10–20 shlokas at a time. The type and rendering code require no changes.

---

### SPEC-09 — Add a minimal CI workflow

**File to create:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun lint
      - run: bun build
      - run: bun run audio:verify
```

**Why:** Currently nothing prevents a broken build from being merged. The `audio:verify` step catches missing MP3 files before they reach production.

**Prerequisite:** SPEC-02 must be done first, otherwise `bun build` will pass even with type errors.

---

## Priority Order

| Priority | Spec | Effort | Impact |
|---|---|---|---|
| 1 | SPEC-03 (devcontainer postCreate) | 2 min | Unblocks new contributors immediately |
| 2 | SPEC-01 (package name) | 1 min | Low effort, removes confusion |
| 3 | SPEC-07 (missing audio UI) | 30 min | Visible UX fix |
| 4 | SPEC-05 (PNG icons) | 1 hr | Fixes PWA installability |
| 5 | SPEC-06 (SW cache versioning) | 30 min | Prevents stale cache bugs |
| 6 | SPEC-02 (enable TS/ESLint) | 1–2 hr | Requires fixing latent errors first |
| 7 | SPEC-04 (split page.tsx) | 3–4 hr | Largest refactor, highest long-term value |
| 8 | SPEC-09 (CI) | 30 min | Depends on SPEC-02 |
| 9 | SPEC-08 (reflection prompts) | ongoing | Content work, no code changes |
