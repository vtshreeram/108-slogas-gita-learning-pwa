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
export type Job = { pack: PackId; title: string; done: number; total: number; bytesDone: number; bytesTotal: number; status: JobStatus; message?: string; quiet?: boolean;
  /** Handed to the browser's download manager (Background Fetch): continues after the app is closed. */
  background?: boolean };
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
/** The running background download, when the browser is doing it. */
let backgroundJob: BackgroundFetchRegistrationLike | undefined;
const BACKGROUND_PREFIX = "gita:";
const BACKGROUND_STALL_MS = 20_000;

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
  navigator.serviceWorker?.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type === "gita-background-fetch") void backgroundFinished(event.data);
  });
  void refresh().then(reattachBackground);
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

async function run(id: PackId, quiet = false, options: { inApp?: boolean } = {}) {
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
  // Downloads a learner starts go to the browser's download manager where it has one, so they survive closing the app.
  if (!quiet && !options.inApp && await startInBackground(pack, items, bytesTotal)) return;
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
export function pause() {
  if (backgroundJob) {
    const job = backgroundJob;
    // The worker files whatever finished, then reports back (backgroundFinished).
    set({ job: snapshot.job && { ...snapshot.job, message: "Pausing…" } });
    void job.abort().catch(() => {});
    // If the worker never reports back (it was stopped, or the browser dropped the event), settle from what is saved.
    setTimeout(() => { if (backgroundJob === job) void backgroundFinished({ id: job.id, result: "abort", saved: 0 }); }, 10_000);
    return;
  }
  controller?.abort();
}
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

// ---- Background downloads (Background Fetch) ----
// Chrome (Android and desktop) can download a pack with its own download manager: it keeps going when the app is
// closed or the phone is locked, and shows progress in the notification shade. The service worker files the
// results (backgroundfetchsuccess / fail / abort in service-worker-template.js) and tells open pages.

type BackgroundFetchRegistrationLike = EventTarget & { id: string; downloaded: number; downloadTotal: number; result: "" | "success" | "failure"; abort(): Promise<boolean> };
type BackgroundFetchManagerLike = {
  fetch(id: string, requests: Request[], options: { title: string; icons: { src: string; sizes: string; type: string }[]; downloadTotal: number }): Promise<BackgroundFetchRegistrationLike>;
  getIds(): Promise<string[]>;
  get(id: string): Promise<BackgroundFetchRegistrationLike | undefined>;
};

/** The browser's background download manager, when this browser has one and the service worker runs this page. */
async function backgroundManager(): Promise<BackgroundFetchManagerLike | undefined> {
  if (typeof window === "undefined" || !("BackgroundFetchManager" in window) || !navigator.serviceWorker?.controller) return undefined;
  const registration = await navigator.serviceWorker.ready.catch(() => undefined);
  return (registration as (ServiceWorkerRegistration & { backgroundFetch?: BackgroundFetchManagerLike }) | undefined)?.backgroundFetch;
}

const packOfBackgroundId = (id: string) => id.startsWith(BACKGROUND_PREFIX) ? id.slice(BACKGROUND_PREFIX.length).split("@")[0] as PackId : undefined;

/** Hand the files to the browser. False when that is not possible here, so the in-app downloader runs instead. */
async function startInBackground(pack: Pack, items: PackItem[], bytesTotal: number): Promise<boolean> {
  const manager = await backgroundManager();
  if (!manager) return false;
  const requests = items.map((item) => {
    const url = new URL(item.url, location.href);
    return new Request(url.href, { mode: url.origin === location.origin ? "same-origin" : "cors" });
  });
  try {
    // The total only drives the progress bar, but the browser stops a download that goes past it: keep a margin.
    const registration = await manager.fetch(`${BACKGROUND_PREFIX}${pack.id}@${Date.now()}`, requests, {
      title: `Gita 108 · ${pack.title}`,
      icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      downloadTotal: Math.ceil(bytesTotal * 1.1),
    });
    follow(registration, pack, items.length, bytesTotal);
    // Some browsers accept a background download but never run it (no download manager, e.g. headless). If nothing
    // arrives at all, take the pack back and download it in the app instead.
    setTimeout(() => {
      if (backgroundJob !== registration || registration.downloaded > 0 || registration.result !== "") return;
      backgroundJob = undefined;
      void registration.abort().catch(() => {});
      void run(pack.id, false, { inApp: true });
    }, BACKGROUND_STALL_MS);
    return true;
  } catch {
    return false; // e.g. the user blocked background downloads: fall back to the in-app downloader
  }
}

function follow(registration: BackgroundFetchRegistrationLike, pack: Pack, total: number, bytesTotal: number) {
  backgroundJob = registration;
  set({ job: { pack: pack.id, title: pack.title, done: 0, total, bytesDone: registration.downloaded, bytesTotal, status: "running", background: true,
    message: "Downloading in the background. You can close the app: progress shows in your notifications." } });
  registration.addEventListener("progress", () => {
    if (backgroundJob !== registration || !snapshot.job) return;
    const finished = registration.result !== "";
    set({ job: { ...snapshot.job, bytesDone: Math.min(registration.downloaded, bytesTotal), ...(finished ? { message: "Saving…" } : {}) } });
  });
}

/** After the app is reopened, show a background download that is still running. */
async function reattachBackground() {
  const manager = await backgroundManager();
  if (!manager || snapshot.job?.status === "running") return;
  for (const id of await manager.getIds().catch(() => [] as string[])) {
    const pack = packById(packOfBackgroundId(id) ?? "essentials");
    const registration = packOfBackgroundId(id) && pack ? await manager.get(id).catch(() => undefined) : undefined;
    if (!registration || registration.result !== "" || !pack) continue;
    const status = packStatus(pack, snapshot.saved);
    follow(registration, pack, toDownload(status).length, bytesNeeded(toDownload(status)));
    return;
  }
}

/** The service worker finished filing a background download (or kept what finished before a pause or failure). */
async function backgroundFinished(message: { id: string; result: "success" | "failure" | "abort"; saved: number }) {
  if (!packOfBackgroundId(message.id)) return;
  const current = backgroundJob?.id === message.id;
  if (current) backgroundJob = undefined;
  await refresh();
  window.dispatchEvent(new Event(DOWNLOADS_CHANGED));
  const pack = packById(packOfBackgroundId(message.id)!);
  if (!current || !pack || !snapshot.job) return;
  const left = toDownload(packStatus(pack, snapshot.saved)).length;
  const status: JobStatus = message.result === "abort" ? "paused" : message.result === "failure" || left ? "error" : "done";
  const text = status === "done" ? `${pack.title} saved for offline use.`
    : status === "paused" ? `Paused. ${message.saved} file${message.saved === 1 ? "" : "s"} saved; ${left} to go.`
      : `The download did not finish (${left} file${left === 1 ? "" : "s"} left). Tap Resume to continue.`;
  set({ job: { ...snapshot.job, status, done: message.saved, background: true, message: text } });
  if (status !== "paused") next();
}
