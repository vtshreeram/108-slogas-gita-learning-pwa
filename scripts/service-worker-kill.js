// EMERGENCY worker, built only when SW_KILL_SWITCH=1 (see docs/incident-runbook.md).
// Use it when a broken service worker is stuck on learners' devices and keeps serving a bad app.
// It removes itself and the app-shell cache so every page loads straight from the network.
// Downloaded verse audio ("gita-audio-*") and saved chapters ("gita-chapters-*") are kept:
// they are the learner's own downloads, and progress in localStorage is never touched.
// It has no fetch handler, so nothing is intercepted while it runs.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(retire()));

async function retire() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("gita-shell-")).map((key) => caches.delete(key)));
  // Only pages the old worker controlled need a reload. A fresh install controls no page, so a page
  // that registers again after this reload is not reloaded a second time: there is no reload loop.
  const pages = await self.clients.matchAll({ type: "window" });
  await self.registration.unregister();
  await Promise.all(pages.map((page) => page.navigate(page.url).catch(() => {})));
}
