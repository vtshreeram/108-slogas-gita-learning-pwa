# Learning tools

## Reading and profile

The home screen opens directly into the reader. **Learn 108** steps through the selected learning collection; **Read all** keeps its place in the full collection even when it crosses a selected verse. Previous/Next controls work in both modes. Find a verse searches references and text, with chapter, selected-108, favorites and learned filters.

Progress, daily goals, streaks, recall statistics, achievements, learned/favorite libraries, pacing, appearance and backups live on `/profile`. Reading and purports use the document scroll, with no swipe interception or fixed-height text regions. The audio dock is compact by default; expand it for seeking, speed, looping and stop. The page reserves the dock's measured height, including the device safe area.

## Daily progress and revision

A verse contributes to the daily learning goal when all four steps become complete, or when the learner confirms **Mark learned** inside the optional memorization tools. Repeating a completion does not count the verse twice. Undo removes that completion. The daily target is configured in the profile. Reaching it presents a choice to finish or keep reading without blocking the text.

Guided recall counts each self-assessment once. Forgot leaves the verse in practice; Difficult completes it with a review tomorrow, and Easy with a review in three days. The known-verse shortcut schedules its first review tomorrow. Existing learned verses without review dates enter the review queue immediately, without assigning an invented historical completion date. Forgotten verses remain due today; Difficult schedules tomorrow; Easy increases the interval (initially three days, then approximately 2.5 times the previous interval, capped at 365 days). Reviews affect recall statistics and the practice streak, but do not inflate today's newly learned total. The clock refreshes on focus and every thirty seconds to handle midnight.

## Offline audio and updates

The device library supports one verse or a selection, cancellation, individual removal and clearing downloads. Audio is stored separately from the app shell, so an app update preserves downloads. Streaming requests retain the browser's native byte-range handling. Downloaded audio supports closed, open-ended and suffix byte ranges, including offline Safari requests. Object URLs also allow downloaded playback when a service worker does not control the page.

Production precaches `/` and `/profile`, including both routes' JS, CSS and font assets. Document navigations prefer the network and fall back to the matching cached route; visiting a profile cannot overwrite the reader shell. Static hashed assets prefer the cache. Chapter and purport APIs are cached separately with network-first refresh; other API and cross-origin requests are excluded. The build fingerprints the app sources and assets into `public/offline-worker.js`; the stable `/sw.js` imports it with cache bypass during update checks. An existing installation prompts before activating a waiting update. Development unregisters this app's old service worker and clears only its shell caches. Browser storage can be evicted by the browser, so the app reports the current library rather than promising permanent downloads.

## Line-by-line practice

The recording contains no authoritative line timestamps. The app does not invent them. Under **Pronunciation & offline tools → Line-by-line practice**, **Listen and follow along** plays immediately without setup. For precise line repetition, open **Adjust line timings (optional)**, choose **Set line timings**, and mark each line's end while listening. Boundaries are saved in the user's local profile and included in backups. Then choose a line, repetitions and whether to continue to the next line. After each playback the app pauses for the length of the line (adjusted for playback speed, with at least one second) so the learner can respond. Main-player transport controls cancel guided playback, including any pending response timer. Closing the tools stops playback; closing timing setup cancels calibration.

Tamil chanting text is mechanically generated from IAST, separately from the Tamil meaning. Superscript consonant distinctions are retained. The source edition's full word-by-word meanings open online; they are not republished or claimed available offline. See [editorial review](editorial-review.md) for all 108 entries requiring independent Sanskrit/Tamil review.

## Saving and backups

The profile distinguishes local saving, pending/successful cloud sync, offline use and storage failures. The reader shows only offline and failure messages when attention is needed. Cloud sync remains controlled by `NEXT_PUBLIC_PROGRESS_SYNC=1` and the existing Firestore setup; it does not claim to be enabled if it is off. Retry is available after saving/sync failures.

Exports include progress, completion dates, review schedules, favourites, custom name and line timings. Original progress-only JSON backups still import. Import first shows a preview with explicit Merge, Replace and Cancel actions. Merge unions learned steps and favourites, preserving current profile preferences and line timings. Replace uses incoming progress and, when present, its profile. Before either operation, the current full backup is saved in `gita-before-restore:<uid>` for recovery. Downloads are device files and are not included in JSON backups.

## Verification

Run `pnpm test`, `pnpm exec tsc --noEmit`, and `pnpm build`. For browser checks, start a **production** server on port 3002, then run `pnpm test:browser`. The browser test uses an isolated, mocked Firebase session; it does not use real accounts or change cloud data. It exercises daily counts, revision ratings, calibrated practice, backups, offline shell reload/audio ranges, keyboard controls and responsive layouts. The automated checks cannot certify pronunciation or translation accuracy, or replace testing lock-screen behaviour on physical iOS and Android devices.

The WebKit check (`pnpm exec playwright install webkit`, then `pnpm test:webkit`) uses a disposable local proxy and disconnects that origin after installation. This avoids a [known Playwright WebKit offline-emulation issue](https://github.com/microsoft/playwright/issues/42775). It checks a real service worker, offline shell navigation, audio range responses and native MP3 playback; the signed-in learning flow is exercised separately in Chromium.
