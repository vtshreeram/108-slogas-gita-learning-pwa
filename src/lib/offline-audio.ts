export const AUDIO_CACHE = "gita-audio-v3";
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

export async function downloadAudio(reference: string, signal?: AbortSignal) {
  const url = audioUrl(reference);
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok || response.status === 206) throw new Error(`Could not download ${reference}. Connect and try again.`);
  const blob = await response.blob();
  if (!blob.size || !/audio\//i.test(response.headers.get("Content-Type") ?? "")) throw new Error(`The audio for ${reference} is unavailable.`);
  if (signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
  const cache = await caches.open(AUDIO_CACHE);
  await cache.put(url, new Response(blob, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(blob.size) } }));
}

/** Object URLs also support offline playback when no service worker controls the page. */
export async function downloadedAudio(reference: string) {
  if (!("caches" in window)) return null;
  const response = await (await caches.open(AUDIO_CACHE)).match(audioUrl(reference));
  return response ? URL.createObjectURL(await response.blob()) : null;
}
