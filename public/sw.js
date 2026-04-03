const SHELL_CACHE = "gita-shell-v3";
const AUDIO_CACHE = "gita-audio-v1";
const KNOWN_CACHES = [SHELL_CACHE, AUDIO_CACHE];
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon.svg"];

/** Slice a full response to satisfy a Range request (Safari requires this for audio). */
function sliceResponse(response, request) {
  const rangeHeader = request.headers.get("Range");
  if (!rangeHeader) return response;

  return response.arrayBuffer().then((buf) => {
    const total = buf.byteLength;
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return new Response(buf, { status: 200, headers: response.headers });

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : total - 1;
    const sliced = buf.slice(start, end + 1);

    return new Response(sliced, {
      status: 206,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
        "Content-Length": String(sliced.byteLength),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
      },
    });
  });
}

/** Fetch audio with Range-request support. Caches the full response, serves sliced. */
function handleAudioRequest(request) {
  const cacheKey = new Request(request.url); // strip Range header for cache key

  return caches.open(AUDIO_CACHE).then((cache) =>
    cache.match(cacheKey).then((cached) => {
      if (cached) return sliceResponse(cached.clone(), request);

      // Fetch without Range to get the full file for caching
      return fetch(new Request(request.url))
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(cacheKey, response.clone());
          }
          return sliceResponse(response, request);
        })
        .catch(() =>
          cache.match(cacheKey).then((fallback) =>
            fallback ? sliceResponse(fallback.clone(), request) : new Response("Audio not available", { status: 404 })
          )
        );
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Let audio requests pass through to the network directly.
  // Safari requires Range-request support that service workers complicate.
  if (url.pathname.startsWith("/audio/")) return;

  // Cache-first for shell assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match("/"));
    })
  );
});
