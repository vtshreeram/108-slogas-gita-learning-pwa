// Keep audio downloads across app updates. Only shell caches are versioned per release.
const SHELL_CACHE = "gita-shell-__RELEASE__";
const NEXT_BUILD_ID = __NEXT_BUILD_ID__;
const REQUIRED_LAZY_ASSETS = __REQUIRED_LAZY_ASSETS__;
const AUDIO_CACHE = "gita-audio-v3";
// Chapter text and purports a learner has opened. Survives app updates and is refreshed whenever online.
// Bounded by construction: the chapter and purport URLs and the search index use one entry each.
const CHAPTER_CACHE = "gita-chapters-v1";
const CHAPTER_TIMEOUT_MS = 4000;

function appAssets(html) {
  return Array.from(html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g), ([, path]) => path.replaceAll("&amp;", "&"));
}

function matchesBuild(html) {
  // Next.js embeds the original build ID as `b` in the inline App Router data.
  const build = /self\.__next_f\.push\(\[1,"0:\{[^<]*?\\"b\\":\\"([^"\\]+)\\"/.exec(html)?.[1];
  return build === NEXT_BUILD_ID;
}

async function cacheShell() {
  const documents = [];
  const assets = new Set(["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", ...REQUIRED_LAZY_ASSETS]);
  for (const path of ["/", "/profile", "/chapters"]) {
    const request = () => new Request(new URL(path, self.location.origin), { cache: "reload" });
    // One retry rides out a flaky connection; a partial shell is never accepted, so offline support is never half-installed.
    let response = await fetch(request()).catch(() => null);
    if (!response?.ok) response = await fetch(request());
    if (!response.ok) throw new Error("Could not download the app shell");
    const html = await response.clone().text();
    if (!matchesBuild(html)) throw new Error("The app shell changed during installation");
    documents.push([path, response]);
    for (const asset of appAssets(html)) assets.add(asset);
  }
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll([...assets]);
  await Promise.all(documents.map(([path, response]) => cache.put(path, response)));
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

async function fetchForCache(request, timeoutMs) {
  const controller = new AbortController();
  const timeout = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const response = await fetch(request, { signal: controller.signal });
    // Clone before either the browser or the cache starts reading the body.
    return { response, copy: response.ok ? response.clone() : undefined };
  } finally { if (timeout) clearTimeout(timeout); }
}

function cacheFetch(event, cache, key, network) {
  event.waitUntil(network.then(async (result) => {
    if (result?.copy) await (await cache).put(key, result.copy);
  }).catch(() => { /* Cache errors must not affect the response. */ }));
}

function chapterData(event) {
  const url = new URL(event.request.url);
  const key = new Request(url.origin + url.pathname); // one entry per chapter, whatever query string the page adds
  const cache = caches.open(CHAPTER_CACHE);
  const saved = cache.then((entries) => entries.match(key)).catch(() => undefined);
  // Serve a saved chapter immediately. Bound the refresh's wait for headers only when a copy exists.
  const network = saved.then((hit) => fetchForCache(event.request, hit ? CHAPTER_TIMEOUT_MS : undefined)).catch(() => undefined);
  event.respondWith(saved.then(async (hit) => hit ?? (await network)?.response
    ?? new Response(JSON.stringify({ error: "Offline" }), { status: 504, headers: { "Content-Type": "application/json" } })));
  cacheFetch(event, cache, key, network);
}

function navigation(event) {
  const path = new URL(event.request.url).pathname;
  const network = fetchForCache(event.request, 5000).catch(() => undefined);
  event.respondWith(network.then(async (result) => result?.response
    ?? await caches.open(SHELL_CACHE).then((cache) => cache.match(path)).catch(() => undefined)
    ?? new Response("Connect once to download Gita 108 for offline use.", { status: 503 })));
  event.waitUntil(network.then(async (result) => {
    if (!result?.copy) return;
    const html = await result.copy.clone().text();
    // A newer deployment has different lazy chunks. Preserve the complete offline shell until its worker takes over.
    if (!matchesBuild(html)) return;
    const cache = await caches.open(SHELL_CACHE);
    const chunks = new Set(appAssets(html));
    const missing = (await Promise.all([...chunks].map(async (chunk) => await cache.match(chunk) ? null : chunk))).filter(Boolean);
    if (missing.length) await cache.addAll(missing);
    // Keep the previous offline page if any chunk for the new page could not be cached.
    await cache.put(path, result.copy);
  }).catch(() => { /* A failed cache write must not discard a good network response. */ }));
}

function staticAsset(event) {
  const { request } = event;
  const cache = caches.open(SHELL_CACHE);
  const saved = cache.then((entries) => entries.match(request)).catch(() => undefined);
  const network = saved.then((hit) => hit ? undefined : fetchForCache(request));
  event.respondWith(saved.then(async (hit) => hit ?? (await network).response));
  cacheFetch(event, cache, request, network);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (/^\/api\/(?:chapters|purports)\/\d+$/.test(url.pathname) || url.pathname === "/api/chapters/search") { chapterData(event); return; }
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/audio/")) { event.respondWith(serveAudio(request)); return; }
  if (request.mode === "navigate") { navigation(event); return; }
  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|ico|webmanifest)$/.test(url.pathname)) staticAsset(event);
});
