import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { AUDIO_CACHE, AUDIO_ENCODING } from "../offline-audio";
import { TEXT_CACHE } from "../offline-packs";
import { CHAPTER_AUDIO_CACHE } from "../chapter-audio-cache";

const ORIGIN = "https://gita.test";

function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return { put: async (key: string, response: Response) => { store.set(key, response); }, match: async () => undefined, addAll: async () => {} };
    }),
    keys: vi.fn(async () => []), delete: vi.fn(),
  };
  const page = { url: `${ORIGIN}/`, postMessage: vi.fn(), focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) };
  const clients = { matchAll: vi.fn(async () => [page]), openWindow: vi.fn(async () => {}), claim: vi.fn() };
  const self = { addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn), skipWaiting: vi.fn(), clients, location: { origin: ORIGIN } };
  const source = readFileSync("scripts/service-worker-template.js", "utf8")
    .replaceAll("__NEXT_BUILD_ID__", '"b"').replaceAll("__REQUIRED_LAZY_ASSETS__", "[]");
  runInNewContext(source, { self, caches, fetch: vi.fn(), Response, Request, URL, AbortController, Blob, setTimeout, clearTimeout });
  /** Fire a background fetch event and wait for its work. */
  const fire = async (type: string, records: { url: string; response: Response | Promise<Response> }[] | "gone", id = "gita:verses108@1") => {
    const tasks: Promise<unknown>[] = [];
    const updateUI = vi.fn(async () => {});
    handlers.get(type)!({
      registration: { id, matchAll: async () => { if (records === "gone") throw new DOMException("records gone", "InvalidStateError"); return records.map((r) => ({ request: new Request(r.url), responseReady: Promise.resolve(r.response) })); } },
      updateUI, waitUntil: (task: Promise<unknown>) => tasks.push(task),
    });
    await Promise.all(tasks);
    return { updateUI };
  };
  return { fire, stores, page, clients, handlers, source };
}
const audio = (bytes: number) => new Response(new Uint8Array(bytes), { headers: { "Content-Type": "audio/mpeg" } });
const json = () => new Response("[]", { headers: { "Content-Type": "application/json" } });

describe("background downloads in the service worker", () => {
  it("uses the same cache names and encoding as the app", () => {
    const { source } = worker();
    expect(source).toContain(`const AUDIO_CACHE = "${AUDIO_CACHE}"`);
    expect(source).toContain(`const CHAPTER_CACHE = "${TEXT_CACHE}"`);
    expect(source).toContain(`const CHAPTER_AUDIO_CACHE = "${CHAPTER_AUDIO_CACHE}"`);
    expect(source).toContain(`const AUDIO_ENCODING = "${AUDIO_ENCODING}"`);
  });

  it("files each finished download where the app reads it, and tells open pages", async () => {
    const { fire, stores, page } = worker();
    const { updateUI } = await fire("backgroundfetchsuccess", [
      { url: `${ORIGIN}/audio/2.47.mp3?download=x`, response: audio(40) },
      { url: `${ORIGIN}/api/chapters/3`, response: json() },
      { url: "https://audio.test/chapter-02.mp3", response: audio(90) },
    ]);
    const verse = stores.get(AUDIO_CACHE)!.get(`${ORIGIN}/audio/2.47.mp3`)!;
    expect(verse.headers.get("X-Gita-Audio-Encoding")).toBe(AUDIO_ENCODING);
    expect(verse.headers.get("Content-Length")).toBe("40");
    expect(stores.get(TEXT_CACHE)!.has(`${ORIGIN}/api/chapters/3`)).toBe(true);
    expect(stores.get(CHAPTER_AUDIO_CACHE)!.has("https://audio.test/chapter-02.mp3")).toBe(true);
    expect(page.postMessage).toHaveBeenCalledWith({ type: "gita-background-fetch", id: "gita:verses108@1", result: "success", saved: 3 });
    expect(updateUI).toHaveBeenCalledWith({ title: "Saved for offline use · 3 files" });
  });

  it("keeps what finished when a download fails, and skips errors and wrong types", async () => {
    const { fire, stores, page } = worker();
    await fire("backgroundfetchfail", [
      { url: `${ORIGIN}/audio/1.1.mp3`, response: audio(10) },
      { url: `${ORIGIN}/audio/1.2.mp3`, response: new Response("gone", { status: 404 }) },
      { url: `${ORIGIN}/audio/1.3.mp3`, response: new Response("<html>", { headers: { "Content-Type": "text/html" } }) },
      { url: `${ORIGIN}/audio/1.4.mp3`, response: Promise.reject(new TypeError("network")) },
    ]);
    expect([...stores.get(AUDIO_CACHE)!.keys()]).toEqual([`${ORIGIN}/audio/1.1.mp3`]);
    expect(page.postMessage).toHaveBeenCalledWith(expect.objectContaining({ result: "failure", saved: 1 }));
  });

  it("still reports a pause when the finished files can no longer be read", async () => {
    const { fire, page } = worker();
    await fire("backgroundfetchabort", "gone");
    expect(page.postMessage).toHaveBeenCalledWith(expect.objectContaining({ result: "abort", saved: 0 }));
  });

  it("answers the page's capability question, so pages know this worker files background downloads", async () => {
    const { handlers } = worker();
    const reply = vi.fn();
    handlers.get("message")!({ data: { type: "gita-capabilities" }, ports: [{ postMessage: reply }] });
    expect(reply).toHaveBeenCalledWith({ backgroundDownloads: 1 });
  });

  it("opens the offline library when the notification is tapped", async () => {
    const { handlers, page, clients } = worker();
    const tasks: Promise<unknown>[] = [];
    handlers.get("backgroundfetchclick")!({ waitUntil: (t: Promise<unknown>) => tasks.push(t) });
    await Promise.all(tasks);
    expect(page.focus).toHaveBeenCalled();
    expect(page.navigate).toHaveBeenCalledWith("/offline");
    clients.matchAll.mockResolvedValueOnce([]);
    const more: Promise<unknown>[] = [];
    handlers.get("backgroundfetchclick")!({ waitUntil: (t: Promise<unknown>) => more.push(t) });
    await Promise.all(more);
    expect(clients.openWindow).toHaveBeenCalledWith("/offline");
  });
});
