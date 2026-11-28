export const AUDIO_CACHE = "gita-audio-v3";
/**
 * How the recordings in public/audio are encoded. Saved copies carry it in a header, so copies saved
 * before a re-encode (they lack it, or name an older one) can be replaced in the background.
 */
export const AUDIO_ENCODING = "mp3-32k-mono";
const ENCODING_HEADER = "X-Gita-Audio-Encoding";
export const audioUrl = (reference: string) => `/audio/${reference}.mp3`;
export const formatBytes = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export async function listDownloads() {
  const cache = await caches.open(AUDIO_CACHE);
  const result: { url: string; bytes: number }[] = [];
  for (const key of await cache.keys()) {
    const response = await cache.match(key);
    if (!response) continue;
    const length = Number(response.headers.get("Content-Length"));
    result.push({ url: new URL(key.url).pathname, bytes: length || (await response.blob()).size });
  }
  return result;
}

/** Saves one verse and returns its size in bytes. */
export async function downloadAudio(reference: string, signal?: AbortSignal): Promise<number> {
  const url = audioUrl(reference);
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok || response.status === 206) throw new Error(`Could not download ${reference}. Connect and try again.`);
  const blob = await response.blob();
  if (!blob.size || !/audio\//i.test(response.headers.get("Content-Type") ?? "")) throw new Error(`The audio for ${reference} is unavailable.`);
  if (signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
  await saveAudio(await caches.open(AUDIO_CACHE), url, blob);
  return blob.size;
}

const saveAudio = (cache: Cache, url: string, blob: Blob) =>
  cache.put(url, new Response(blob, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(blob.size), [ENCODING_HEADER]: AUDIO_ENCODING } }));

type RefreshDeps = { cache: Cache; fetchFn?: typeof fetch; signal?: AbortSignal };

/**
 * Replaces saved recordings that predate the current encoding with the current files, one at a time.
 * A saved copy keeps playing until its replacement has fully downloaded. Stops at the first failure
 * (offline, server error) and tries again on a later visit. Returns how many were replaced.
 */
export async function refreshOutdatedDownloads({ cache, fetchFn = fetch, signal }: RefreshDeps): Promise<number> {
  let replaced = 0;
  for (const key of await cache.keys()) {
    if (signal?.aborted) break;
    const saved = await cache.match(key);
    if (!saved || saved.headers.get(ENCODING_HEADER) === AUDIO_ENCODING) continue;
    const path = new URL(key.url).pathname;
    try {
      // The query string makes the service worker fetch from the network instead of answering with this saved copy.
      const response = await fetchFn(`${path}?encoding=${AUDIO_ENCODING}`, { signal, cache: "no-store" });
      if (!response.ok || response.status === 206 || !/audio\//i.test(response.headers.get("Content-Type") ?? "")) break;
      const blob = await response.blob();
      if (!blob.size || signal?.aborted) break;
      // The learner may have removed this download while its replacement was on the way: do not bring it back.
      if (!(await cache.match(key))) continue;
      await saveAudio(cache, path, blob);
      replaced++;
    } catch { break; }
  }
  return replaced;
}

/** Cheap presence check (no body is read), so callers only build an object URL when they will really use it. */
export async function hasDownloadedAudio(reference: string) {
  if (!("caches" in window)) return false;
  return Boolean(await (await caches.open(AUDIO_CACHE)).match(audioUrl(reference)));
}

/** Object URLs also support offline playback when no service worker controls the page. */
export async function downloadedAudio(reference: string) {
  if (!("caches" in window)) return null;
  const response = await (await caches.open(AUDIO_CACHE)).match(audioUrl(reference));
  return response ? URL.createObjectURL(await response.blob()) : null;
}
