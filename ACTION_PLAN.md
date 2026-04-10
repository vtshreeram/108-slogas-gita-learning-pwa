# Action Plan - Gita Learning PWA Improvements

**Created:** 2026-04-10  
**Branch:** shreeram

---

## 📋 Execution Order (By Phase & Priority)

### 🔴 **PHASE 1: Critical User-Facing Bugs** (Complete First)
These directly impact user experience and must be fixed before other work.

| # | Task | Impact | Est. Complexity |
|---|------|--------|-----------------|
| 1 | Fix audio playback after lock screen song ends | Audio won't replay | High |
| 2 | Fix lock screen player redirecting to AI Studio | Navigation broken | High |
| 3 | Replace generic loader with Krishna quote | UX improvement | Low |
| 4 | Redesign "Mark as Learned" dialog for mobile | Mobile UX issue | Medium |

**Order:** 2 → 1 → 3 → 4  
**Why:** Fix navigation first (it's preventing testing), then audio, then UX polish.

---

### 🟠 **PHASE 2: State Logic & Data Integrity** (Parallel with Phase 1 testing)
These are correctness issues that could cause silent data bugs.

| # | Task | Impact | Dependencies |
|---|------|--------|--------------|
| 8 | Fix streak logic edge case | Streak resets incorrectly | None |
| 13 | Clarify content mode types | Confusing enum usage | None |
| 7 | Consolidate backup/restore logic | Risk of schema mismatch | None |
| 12 | Add unit tests for useShlokaState hook | Prevents regressions | After #8, #13 |

**Order:** 13 → 8 → 7 → 12

---

### 🟡 **PHASE 3: Code Quality & Maintainability** (After Phase 1 is stable)
Refactoring and cleanup to improve codebase health.

| # | Task | Impact | Dependencies |
|---|------|--------|--------------|
| 6 | Extract Firebase auth logic | Code reuse | None |
| 10 | Create DialogCard wrapper | Reduce duplication | None |
| 11 | Centralize color tokens | Dark mode consistency | Should coordinate with #4 |
| 14 | Extract hardcoded swipe threshold | Consistency | None |
| 17 | Extract audio timing constants | Clarity | None |
| 16 | Remove unused daysBetween constant | Cleanup | None |
| 9 | Add accessibility labels to icon buttons | a11y improvement | Coordinate with #4 |

**Order:** 13 → 6 → 10 → 11 → 14 → 17 → 16 → 9

---

### 🟢 **PHASE 4: Infrastructure & Performance** (Polish phase)
Bundle optimization and long-term maintenance.

| # | Task | Impact | Dependencies |
|---|------|--------|--------------|
| 5 | Remove unused shadcn/ui components | Smaller bundle | None |
| 15 | Add error boundaries for audio player | Resilience | After #1 testing |
| 18 | Add service worker cache versioning | Update reliability | None |

**Order:** 18 → 5 → 15

---

## 🗓️ Implementation Timeline

```
Week 1 (Critical Fixes)
├─ Day 1: Phase 1 bugs (#2, #1, #3, #4)
└─ Day 2-3: Test on mobile, gather feedback

Week 2 (Logic Fixes)
├─ Day 1: Phase 2 state fixes (#13, #8, #7)
└─ Day 2: Phase 2 testing (#12)

Week 3 (Refactoring)
├─ Day 1-2: Phase 3 code quality (#6, #10, #11)
└─ Day 3: Phase 3 completion (#14, #17, #16, #9)

Week 4 (Polish)
├─ Day 1-2: Phase 4 infrastructure (#18, #5, #15)
└─ Day 3: Final QA & merge to main
```

---

## 🔗 Task Dependencies

```
Phase 1 (Independent)
  ├─ #2 (lock screen redirect)
  ├─ #1 (audio playback) → #15 (error boundaries)
  ├─ #3 (loader)
  └─ #4 (dialog redesign) ← #11 (color tokens)

Phase 2 (Sequential)
  ├─ #13 (content modes)
  ├─ #8 (streak logic) → #12 (tests)
  ├─ #7 (backup logic)
  └─ #12 (tests for #8, #13)

Phase 3 (Mostly Independent)
  ├─ #6 (auth extraction)
  ├─ #10 (dialog wrapper) ← #4 (redesign first)
  ├─ #11 (color tokens) ← #4 (use new tokens)
  ├─ #14 (swipe threshold)
  ├─ #17 (timing constants)
  ├─ #16 (cleanup)
  └─ #9 (a11y) ← #4 (dialog a11y)

Phase 4 (Mostly Independent)
  ├─ #18 (cache versioning)
  ├─ #5 (remove deps) → #6 (auth may use some)
  └─ #15 (error boundaries) ← #1 (after audio fixed)
```

---

## 📝 Notes & Decisions

### Audio Lock Screen Issues (#1, #2)
- **Hypothesis:** Media Session API setup or click handler not properly resetting playback state
- **Investigation:** Check `audio-player.tsx` for state management after song end, and Media Session click handler
- **Risk:** May require debugging on actual device/browser dev tools

### Krishna Quote Loader (#3)
- **Approach:** Extract 5-10 inspiring quotes from Gita chapters, rotate on load
- **Consider:** Caching quote to avoid same quote on consecutive loads
- **File location:** New component `src/components/loader-quote.tsx`

### Mobile Dialog Redesign (#4)
- **Constraints:** Max width 320px on small phones, proper padding
- **Contrast check:** WCAG AA minimum 4.5:1 for text on background
- **Test:** Chrome DevTools mobile emulation, iOS Safari, Android Chrome

### Content Modes (#13)
- **Current state:** "tamil" is in the enum but behavior is unclear
- **Decision needed:** Will "Tamil" transliteration be fully supported? If not, remove from UI
- **Implication:** Affects task #11 (if removing tamil, fewer modes to style)

### Unused Components (#5)
- **Before removing:** Check if any are imported by `@tailwindcss/postcss` or other loaders
- **Batch removal:** Remove in one PR to avoid partial cleanup

---

## ✅ Definition of Done

Each task is complete when:
1. Code changes are committed to `shreeram` branch
2. Tests pass (if applicable)
3. Mobile UI verified (for UI tasks)
4. No console errors in dev/prod build
5. Code review checklist passed

---

## 🚀 Quick Start

```bash
# Current branch
git branch -v

# Run dev server for testing
npm run dev

# Run tests
npm run test:watch

# Build to check for errors
npm run build

# Lint
npm run lint
```

---

## 📌 Key Files to Watch

- `src/app/page.tsx` — Main app layout, dialogs
- `src/components/audio-player.tsx` — Audio & lock screen logic
- `src/components/shloka-card.tsx` — Swipe gestures, UI
- `src/hooks/use-shloka-state.ts` — State management, migrations
- `src/lib/constants.ts` — Config & types
- `public/sw.js` — Service worker caching
- `src/lib/firebase.ts` — Auth setup
- `src/app/layout.tsx` — App shell, loader

---

## 💡 Context

This action plan prioritizes user-facing bugs first (audio, navigation, UX), followed by data integrity (state logic), then technical debt. The phases are designed to be mostly independent so work can be parallelized where safe.

**High-risk areas:** Audio playback, state migrations, Firebase auth. These may need device testing.
