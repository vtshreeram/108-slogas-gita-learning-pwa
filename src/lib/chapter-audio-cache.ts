/** Saved chapter recordings (Offline library). Kept tiny: the chapter player, on every screen, imports it. */
export const CHAPTER_AUDIO_CACHE = "gita-chapter-audio-v1";

const absolute = (url: string) => new URL(url, location.href).href;

/** Full URLs of the chapter recordings saved on this device. */
export async function savedChapterUrls(): Promise<Set<string>> {
  if (typeof caches === "undefined") return new Set();
  const keys = await (await caches.open(CHAPTER_AUDIO_CACHE)).keys();
  return new Set(keys.map((request) => request.url));
}

/** The saved copy as an object URL (seeking works without a network or service worker), or null. The caller revokes it. */
export async function savedChapterAudio(url: string): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  const response = await (await caches.open(CHAPTER_AUDIO_CACHE)).match(absolute(url));
  return response ? URL.createObjectURL(await response.blob()) : null;
}
