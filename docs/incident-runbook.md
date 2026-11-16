# Incident runbook: "the app stopped working"

Goal: learners working again within minutes, then the root cause fixed calmly.
Saved progress lives on each device (localStorage), so an outage never loses it.

## 1. Restore service first (target: under 10 minutes)

1. **Confirm and size it.** Open `https://<site>/api/health` (should return `{"status":"ok"}`),
   the home page, `/api/chapters/1`, and one verse audio file. Try a private window too: if only
   the installed app fails, the cause is a cached service worker, not the server (go to step 4).
2. **Did a deploy just happen? Roll back.** Vercel → Project → Deployments → last good deployment →
   *Instant Rollback* (or *Promote to Production*). This needs no code change and is the fastest fix.
3. **Not a deploy? Check what the app depends on.**
   - Domain/DNS and TLS certificate still valid.
   - Chapter audio: the R2 bucket `bhagavad-gita-audio` and `https://108-imp-slogas-audio.peacockindia.in`
     (only `/chapters` breaks if this is down; verses still work).
   - Build-time variables in Vercel (`NEXT_PUBLIC_CHAPTER_AUDIO_BASE`, and Firebase ones if
     `NEXT_PUBLIC_PROGRESS_SYNC=1`). A missing value needs a **redeploy**, not just a save.
   - Firebase/Google sign-in status page, if sign-in is failing.
4. **Installed apps stuck on a broken version?** (Errors persist after rollback, only for people who
   had the app open/installed, private windows work.) Use the service worker kill switch:
   - Vercel → Settings → Environment Variables → add `SW_KILL_SWITCH=1` (Production) → redeploy.
   - On the next visit, the worker clears the cached app shell, unregisters itself and reloads open
     pages from the network. Downloaded verse audio, saved chapters and progress are kept.
   - Offline support is off while the switch is on. **Remove the variable and redeploy** once the
     fixed release is live; the normal worker then reinstalls on its own.
5. **Tell learners** (where you announce updates): what is affected, that progress is safe, and when
   to expect the fix.

## 2. Find the cause

- **Crash reports:** Vercel → Project → Logs, search `client_error`. Each line is JSON with `source`
  (`window-error`, `unhandled-rejection`, `route-boundary`, `root-boundary`, `audio-boundary`),
  `message`, `stack`, `path`, `release` (commit) and `online`. Reports carry no user id or progress.
  Each browser sends at most 5 distinct reports per page load.
- **Server errors:** the same Logs view, filtered to the `/api/...` routes.
- **What changed:** `git log <last-good-commit>..HEAD`, dependency bumps in `pnpm-lock.yaml`,
  changes to `src/lib/learning-progress.ts` (stored data format) or `scripts/service-worker-template.js`.
- **Reproduce locally:** `pnpm build && pnpm start`, then the browser checks (`npm run test:browser`).

## 3. Fix forward and close out

1. Fix on a branch, run `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`.
2. Check the Vercel preview deployment, then promote it.
3. If the kill switch was used, remove `SW_KILL_SWITCH` and redeploy.
4. Write a short note: what broke, how long, how it was noticed, the fix, and one change that would
   have caught it earlier (a test, an alert, a check in this runbook).

## Monitoring to keep switched on

- **Uptime monitor** (any external service, e.g. UptimeRobot or Better Stack) every 5 minutes on
  `/api/health`, `/`, `/api/chapters/1` and one chapter audio URL, alerting by email/phone.
- **Log alert** in Vercel (or a log drain) on a spike of `client_error` lines after a deploy.

## What already protects learners

- `src/app/error.tsx`: page-level crash screen; offers *Reload* when app files changed mid-session.
- `src/app/global-error.tsx`: crash screen when the root layout itself fails (no blank page).
- `AudioErrorBoundary`: an audio failure never takes down the verse screen.
- Unreadable saved progress is set aside (`-corrupt` key), never thrown away, and the app starts.
