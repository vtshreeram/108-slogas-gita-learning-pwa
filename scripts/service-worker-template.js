// Keep audio downloads across app updates. Only shell caches are versioned per release.
const SHELL_CACHE = "gita-shell-__RELEASE__";
const AUDIO_CACHE = "gita-audio-v3";
// Chapter text and purports a learner has opened. Survives app updates and is refreshed whenever online.
// Bounded by construction: only the 18 chapter and 18 purport URLs are ever stored (query strings are dropped).
const CHAPTER_CACHE = "gita-chapters-v1";
const CHAPTER_TIMEOUT_MS = 4000;

async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const assets = new Set(["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"]);
  // Both routes and their distinct chunks must be ready for a cold offline launch.
  for (const path of ["/", "/profile", "/chapters"]) {
    const response = await fetch(new Request(new URL(path, self.location.origin), { cache: "reload" }));
    if (!response.ok) throw new Error("Could not download the app shell");
    const html = await response.clone().text();
    await cache.put(path, response);
    for (const match of html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)) assets.add(match[1].replaceAll("&amp;", "&"));
  }
  await cache.addAll([...assets]);
}

self.addEventListener("install", (event) => event.waitUntil(cacheShell()));
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("gita-shell-") && key !== SHELL_CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
})()));

/** Safari requests byte ranges. Serve valid closed, open-ended and suffix ranges. */
async function audioRange(response, range) {
  if (!range) return response;
  // A Blob is a handle onto the cached bytes: slicing it copies nothing, unlike reading the whole file into an ArrayBuffer.
  const blob = await response.blob();
  const size = blob.size;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid = () => new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  if (!match || (!match[1] && !match[2])) return invalid();
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
  if (start >= size || start > end || size === 0) return invalid();
  return new Response(blob.slice(start, end + 1, response.headers.get("Content-Type") || "audio/mpeg"), { status: 206, headers: {
    "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
    "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes",
  } });
}

async function serveAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const full = await cache.match(new Request(request.url));
  // Online streaming keeps the browser's native Range handling. Download is explicit.
  if (!full) return fetch(request);
  return audioRange(full, request.headers.get("Range"));
}

async function chapterData(request) {
  const url = new URL(request.url);
  const key = new Request(url.origin + url.pathname); // one entry per chapter, whatever query string the page adds
  const cache = await caches.open(CHAPTER_CACHE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAPTER_TIMEOUT_MS); // a stalled network falls back to what is saved
  try {
    const response = await fetch(request, { signal: controller.signal });
    // The timer guards only the wait for the first byte. Aborting later would cut a slow but healthy body download short.
    clearTimeout(timeout);
    // Only a good response is stored; an error page must never replace a saved chapter.
    if (response.ok) await cache.put(key, response.clone()).catch(() => {}); // a full disk must not fail a good response
    return response;
  } catch {
    return (await cache.match(key)) ?? new Response(JSON.stringify({ error: "Offline" }), { status: 504, headers: { "Content-Type": "application/json" } });
  } finally { clearTimeout(timeout); }
}

async function navigation(request) {
  const path = new URL(request.url).pathname;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(path, response.clone());
    }
    return response;
  } catch {
    return (await (await caches.open(SHELL_CACHE)).match(path)) ?? new Response("Connect once to download Gita 108 for offline use.", { status: 503 });
  } finally { clearTimeout(timeout); }
}

async function staticAsset(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (/^\/api\/(?:chapters|purports)\/\d+$/.test(url.pathname)) { event.respondWith(chapterData(request)); return; }
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/audio/")) { event.respondWith(serveAudio(request)); return; }
  if (request.mode === "navigate") { event.respondWith(navigation(request)); return; }
  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|ico|webmanifest)$/.test(url.pathname)) event.respondWith(staticAsset(request));
});
