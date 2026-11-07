# Reading-first UX improvements

The redesign uses the supplied mobile screenshot and the project's existing warm palette. The screen's primary job is reading and understanding a shloka. Memorization is optional, explicit, and saved; account metrics belong to the profile.

The visual remix restores the original rounded, gold-outlined verse card and pill language tabs. A compact chapter reference replaces the oversized heading; the reading column is capped at 36rem. Avatar and theme controls return to the header, study tools use illustrated disclosure rows, and the player floats in a small rounded dock. Purports retain natural page scrolling and all learning flows remain available.

## Implemented decisions

| Audit concern | Result |
| --- | --- |
| Progress competes with the verse | Removed from the home screen. `/profile` holds progress, daily goals, streaks, recall attempts/success, achievements, learned verses and favorites. |
| Purport scrolling feels locked | Purports and Tamil meanings expand to their natural height. Removed internal text scrollers, touch/swipe interception and persistent learning pills. |
| Oversized player covers content | A roughly 66px floating dock replaces the previous 133px player. Play/pause stays visible; seeking, speed, looping, repeat and stop expand on demand. The page reserves its measured height plus the device's bottom safe area. |
| Confusing learning buttons | Optional guided practice explains each action. Play recording does not mark Listen complete. Explicit confirmations follow listening, repeating and understanding. |
| Recall tap reveals and records success | Recall opens a dedicated exercise with separate Reveal and Forgot/Difficult/Easy actions. Each assessment counts once. |
| Reading silently switches to selected verses | Reading collection is explicit. Read all preserves continuity across selected verses; visible Previous/Next controls replace swipe-only navigation. |
| Small controls and narrow header collisions | Header has compact branding, appearance and profile controls. Primary controls use 44px minimum targets; search becomes an icon at narrow widths. Content labels shorten on the smallest phones with full accessible names. |
| Hidden review and no daily finish | Due reviews appear before new learning. The last rating retains its completion dialog. The daily goal offers Finish or Keep reading. |
| Hard-to-read meanings | Left-aligned prose, regular Tamil weight, Geist body text and Noto Sans Tamil, with generous line spacing and source attribution. |
| Saved verses cannot be retrieved | Searchable picker with chapter/collection filters; learned and favorite libraries on the profile link back to their verses. |
| First visit lacks explanation | Welcome screen explains the four-stage routine and pace, includes a sample verse, and shows an actionable inline sign-in error. Closing a Google popup no longer forces a redirect. |
| Line timing setup blocks practice | Listen-and-follow playback is immediate. Precise line timings remain optional advanced setup; no unreviewed timestamps are invented. |
| Profile must also work offline | Both route shells and their assets are precached separately. Account navigation uses document requests so the service worker can return the correct offline HTML. |

## Verification

- Production build passes, including TypeScript and Next.js lint checks.
- 120 unit tests pass, including guided-recall accounting and separation of offline route caches.
- Production Chromium flow passes: reading continuity, purport page scrolling, responsive widths 320/390/768/1024/1440, learning confirmations, recall, revision, calibration and response pauses, transport cancellation, favorites, profile preferences, full/legacy backups, offline route navigation/audio and app updates.
- Axe checks report zero violations in sampled reader, expanded purport/tools, profile, dark reader and dark profile states.
- Additional browser checks pass: keyboard focus returns after closing the picker; 200% text at 320/390/768px; all expanded-player controls fit at 320px and remain at least 44px high; the last page control clears the fixed dock.
- WebKit passes production offline shell reload, closed/suffix/invalid audio ranges and native MP3 playback.

Screenshots and test logs are generated under `test-results/`. Tests use an isolated mocked account and do not change real cloud data. Physical-device lock-screen audio, actual Google sign-in, production cloud sync, human screen-reader testing and Sanskrit/Tamil editorial accuracy still require validation in their respective environments.
