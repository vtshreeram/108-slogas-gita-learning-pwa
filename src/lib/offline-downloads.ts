/**
 * Offline library: browser side. One download job runs at a time (others wait in a queue) and keeps
 * running while the app is open on any screen. Files are saved in the same caches the app and the
 * service worker already read: verse audio in AUDIO_CACHE, chapter text in TEXT_CACHE, chapter
 * recordings in CHAPTER_AUDIO_CACHE. Pure rules (pack contents, status, storage fit) are in offline-packs.ts.
 */
import sizes from "@/data/audio-sizes.json";
import { SHLOKAS } from "./shlokas";
import { VERSE_INDEX } from "./verse-index";
import { AUDIO_CACHE, AUDIO_ENCODING } from "./offline-audio";
import { CHAPTER_AUDIO_CACHE, TEXT_CACHE, buildPacks, bytesNeeded, fitsInStorage, formatMB, packStatus, toDownload, type Pack, type PackId, type PackItem } from "./offline-packs";

export const DOWNLOADS_CHANGED = "gita-downloads-changed";
const PARALLEL = 3;

export type JobStatus = "running" | "paused" | "error" | "done";
export type Job = { pack: PackId; title: string; done: number; total: number; bytesDone: number; bytesTotal: number; status: JobStatus; message?: string; quiet?: boolean };
export type Snapshot = { ready: boolean; supported: boolean; saved: ReadonlyMap<string, number>; job?: Job; queue: readonly PackId[]; persisted?: boolean; estimate?: { quota?: number; usage?: number } };

let packs: Pack[] | undefined;
export function allPacks(): Pack[] {
  return (packs ??= buildPacks({ important: SHLOKAS.map((s) => s.reference), all: VERSE_INDEX.map((v) => v.reference), sizes }));
}
const packById = (id: PackId) => allPacks().find((p) => p.id === id);

let snapshot: Snapshot = { ready: false, supported: false, saved: new Map(), queue: [] };
const listeners = new Set<() => void>();
const set = (next: Partial<Snapshot>) => { snapshot = { ...snapshot, ...next }; listeners.forEach((l) => l()); };
let controller: AbortController | undefined;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) init();
  return () => { listeners.delete(listener); };
}
export const getSnapshot = () => snapshot;
const SERVER_SNAPSHOT: Snapshot = { ready: false, supported: false, saved: new Map(), queue: [] };
export const getServerSnapshot = () => SERVER_SNAPSHOT;

let initialised = false;
function init() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  const supported = window.isSecureContext && "caches" in window;
  set({ supported });
  if (!supported) { set({ ready: true }); return; }
  // The study-tools download list and the background refresh change the same caches.
  window.addEventListener(DOWNLOADS_CHANGED, () => { if (snapshot.job?.status !== "running") void refresh(); });
  void refresh();
}

/** Same-origin cache keys are compared by pathname (the service worker keys text by pathname too). */
const keyOf = (url: string) => { const u = new URL(url, location.href); return u.origin === location.origin ? u.pathname : u.href; };

/** Re-read what is saved, and how much storage is used and allowed. */
export async function refresh() {
  const saved = new Map<string, number>();
  try {
    for (const name of [TEXT_CACHE, AUDIO_CACHE, CHAPTER_AUDIO_CACHE]) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = name === TEXT_CACHE ? undefined : await cache.match(request);
        const length = Number(response?.headers.get("Content-Length"));
        saved.set(keyOf(request.url), name === TEXT_CACHE ? 0 : length || (await response?.blob())?.size || 0);
      }
    }
  } catch { /* storage blocked: show nothing saved */ }
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = await navigator.storage?.persisted?.().catch(() => undefined);
  set({ ready: true, saved, estimate: estimate && { quota: estimate.quota, usage: estimate.usage }, persisted });
}

/** Ask the browser not to clear downloads when space runs low. Granted silently or after a prompt, depending on the browser. */
async function askToPersist() {
  if (snapshot.persisted || !navigator.storage?.persist) return;
  const persisted = await navigator.storage.persist().catch(() => false);
  set({ persisted });
}

/** Download one file and save it where the app reads it. Returns the saved size. */
async function saveItem(item: PackItem, signal: AbortSignal): Promise<number> {
  const audio = item.cache !== TEXT_CACHE;
  const sameOrigin = new URL(item.url, location.href).origin === location.origin;
  // A query string makes the service worker go to the network instead of answering with an older saved copy.
  const url = audio && sameOrigin ? `${item.url}?download=${AUDIO_ENCODING}` : item.url;
  const response = await fetch(url, { signal, cache: "no-store", mode: sameOrigin ? "same-origin" : "cors" });
  const type = response.headers.get("Content-Type") ?? "";
  if (!response.ok || response.status === 206 || (audio ? !/audio\//i.test(type) : !/json/i.test(type))) throw new Error(`Could not download ${item.url} (${response.status}).`);
  const blob = await response.blob();
  if (!blob.size) throw new Error(`${item.url} was empty.`);
  const cache = await caches.open(item.cache);
  const headers: Record<string, string> = { "Content-Type": audio ? "audio/mpeg" : "application/json; charset=utf-8", "Content-Length": String(blob.size) };
  if (item.cache === AUDIO_CACHE) headers["X-Gita-Audio-Encoding"] = AUDIO_ENCODING; // understood by refreshOutdatedDownloads
  // Text is keyed exactly as the service worker keys it (origin + pathname), so offline reads find it.
  const key = item.cache === TEXT_CACHE ? new Request(location.origin + new URL(item.url, location.href).pathname) : new Request(new URL(item.url, location.href).href);
  await cache.put(key, new Response(blob, { headers }));
  return blob.size;
}

function friendly(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") return "Your device ran out of space for this site. Free some space, or remove a pack, then tap Resume.";
  if (!navigator.onLine) return "You went offline. Tap Resume when you are connected again.";
  return error instanceof Error ? `${error.message} Tap Resume to try again.` : "The download stopped. Tap Resume to try again.";
}

/** Queue a pack (or start it now if nothing is running). `quiet` jobs are the automatic Essentials download. */
export function start(id: PackId, options: { quiet?: boolean } = {}) {
  if (!snapshot.supported) return;
  if (snapshot.job?.pack === id && snapshot.job.status === "running") return;
  if (snapshot.job?.status === "running") {
    if (!snapshot.queue.includes(id)) set({ queue: [...snapshot.queue, id] });
    return;
  }
  void run(id, options.quiet);
}

async function run(id: PackId, quiet = false) {
  const pack = packById(id);
  if (!pack) return;
  // Claim the slot before the first await, so a second tap queues instead of starting a parallel job.
  set({ job: { pack: id, title: pack.title, done: 0, total: 0, bytesDone: 0, bytesTotal: 0, status: "running", quiet } });
  await refresh();
  const items = toDownload(packStatus(pack, snapshot.saved));
  if (!items.length) { set({ job: quiet ? undefined : { pack: id, title: pack.title, done: 0, total: 0, bytesDone: 0, bytesTotal: 0, status: "done", message: `${pack.title} is already saved.` } }); return next(); }
  const bytesTotal = bytesNeeded(items);
  if (!fitsInStorage(bytesTotal, snapshot.estimate)) {
    set({ job: { pack: id, title: pack.title, done: 0, total: items.length, bytesDone: 0, bytesTotal, status: "error", quiet, message: `${pack.title} needs about ${formatMB(bytesTotal)}, which is more than this browser allows the app to store right now. Remove another pack or free some space on the device.` } });
    return next();
  }
  if (!quiet) await askToPersist();
  controller = new AbortController();
  const { signal } = controller;
  let done = 0, bytesDone = 0, failure: unknown;
  set({ job: { pack: id, title: pack.title, done, total: items.length, bytesDone, bytesTotal, status: "running", quiet } });
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item && !signal.aborted && !failure; item = queue.shift()) {
      try {
        const saved = await saveItem(item, signal);
        done++; bytesDone += item.bytes ?? saved;
        const map = new Map(snapshot.saved); map.set(keyOf(item.url), saved);
        set({ saved: map, job: { ...snapshot.job!, done, bytesDone } });
      } catch (error) { if (!signal.aborted) { failure = error; controller?.abort(); } }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  const status: JobStatus = failure ? "error" : signal.aborted ? "paused" : "done";
  set({ job: { ...snapshot.job!, status, message: failure ? friendly(failure) : status === "done" ? `${pack.title} saved for offline use.` : `Paused. ${done} of ${items.length} files saved.` } });
  await refresh();
  window.dispatchEvent(new Event(DOWNLOADS_CHANGED));
  if (status !== "paused") next();
}

function next() {
  const [following, ...rest] = snapshot.queue;
  if (!following) return;
  set({ queue: rest });
  void run(following);
}

/** Stop after the files in flight; saved files are kept, and Resume continues with the rest. */
export function pause() { controller?.abort(); }
export function resume() { if (snapshot.job) start(snapshot.job.pack); }
export function dequeue(id: PackId) { set({ queue: snapshot.queue.filter((q) => q !== id) }); }

/** Remove a pack's files. A file shared with another pack (the 108 are inside the 657) is removed from both. */
export async function remove(id: PackId) {
  const pack = packById(id);
  if (!pack || snapshot.job?.status === "running" && snapshot.job.pack === id) return;
  for (const item of pack.items) {
    const cache = await caches.open(item.cache);
    const url = new URL(item.url, location.href);
    await cache.delete(item.cache === TEXT_CACHE ? new Request(location.origin + url.pathname) : url.href);
  }
  if (snapshot.job?.pack === id) set({ job: undefined });
  await refresh();
  window.dispatchEvent(new Event(DOWNLOADS_CHANGED));
}
