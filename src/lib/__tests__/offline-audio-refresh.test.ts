import { describe, expect, it, vi } from "vitest";
import { AUDIO_ENCODING, refreshOutdatedDownloads } from "../offline-audio";

/** A Cache Storage stand-in that keeps Responses by URL. */
function fakeCache(entries: Record<string, Response>) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    keys: async () => [...store.keys()].map((url) => new Request(`https://gita.test${url}`)),
    match: async (key: Request | string) => store.get(typeof key === "string" ? key : new URL(key.url).pathname)?.clone(),
    put: async (url: string, response: Response) => { store.set(url, response); },
  } as unknown as Cache & { store: Map<string, Response> };
}
const saved = (bytes: number, encoding?: string) => new Response(new Uint8Array(bytes), { headers: { "Content-Type": "audio/mpeg", ...(encoding ? { "X-Gita-Audio-Encoding": encoding } : {}) } });
const served = (bytes: number) => new Response(new Uint8Array(bytes), { headers: { "Content-Type": "audio/mpeg" } });

describe("refreshOutdatedDownloads", () => {
  it("replaces only copies saved before the current encoding, bypassing the saved copy", async () => {
    const cache = fakeCache({ "/audio/2.47.mp3": saved(100), "/audio/18.66.mp3": saved(50, AUDIO_ENCODING) });
    const fetchFn = vi.fn<(url: string) => Promise<Response>>(async () => served(40));
    expect(await refreshOutdatedDownloads({ cache, fetchFn: fetchFn as unknown as typeof fetch })).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(`/audio/2.47.mp3?encoding=${AUDIO_ENCODING}`);
    const fresh = cache.store.get("/audio/2.47.mp3")!;
    expect(fresh.headers.get("X-Gita-Audio-Encoding")).toBe(AUDIO_ENCODING);
    expect((await fresh.clone().blob()).size).toBe(40);
    expect(await refreshOutdatedDownloads({ cache, fetchFn: fetchFn as unknown as typeof fetch })).toBe(0); // nothing left to do
  });

  it("keeps the old copy and stops when offline or the server fails", async () => {
    const cache = fakeCache({ "/audio/1.1.mp3": saved(100), "/audio/1.2.mp3": saved(100) });
    expect(await refreshOutdatedDownloads({ cache, fetchFn: vi.fn(async () => { throw new TypeError("offline"); }) })).toBe(0);
    expect(await refreshOutdatedDownloads({ cache, fetchFn: vi.fn(async () => new Response("no", { status: 503 })) })).toBe(0);
    expect(await refreshOutdatedDownloads({ cache, fetchFn: vi.fn(async () => new Response("<html>", { headers: { "Content-Type": "text/html" } })) })).toBe(0);
    expect((await cache.store.get("/audio/1.1.mp3")!.clone().blob()).size).toBe(100);
  });

  it("does not restore a download the learner removed while its replacement was downloading", async () => {
    const cache = fakeCache({ "/audio/2.47.mp3": saved(100) });
    const fetchFn = vi.fn(async () => { cache.store.delete("/audio/2.47.mp3"); return served(40); });
    expect(await refreshOutdatedDownloads({ cache, fetchFn: fetchFn as unknown as typeof fetch })).toBe(0);
    expect(cache.store.has("/audio/2.47.mp3")).toBe(false);
  });

  it("stops when cancelled", async () => {
    const cache = fakeCache({ "/audio/1.1.mp3": saved(100) });
    const controller = new AbortController(); controller.abort();
    expect(await refreshOutdatedDownloads({ cache, fetchFn: vi.fn(async () => served(40)), signal: controller.signal })).toBe(0);
  });
});
