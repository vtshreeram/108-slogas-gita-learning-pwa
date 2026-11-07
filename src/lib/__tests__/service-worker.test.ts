import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const cache = { match: vi.fn(), put: vi.fn(), addAll: vi.fn(), add: vi.fn() };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ["other-app", "gita-shell-v5", "gita-shell-__RELEASE__", "gita-audio-v3"]), delete: vi.fn() };
  const self = { addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn), skipWaiting: vi.fn(), clients: { claim: vi.fn() }, location: { origin: "https://gita.test" } };
  const fetch = vi.fn();
  const context = { self, caches, fetch, Response, Request, URL, AbortController, Blob, setTimeout, clearTimeout };
  const source = readFileSync("scripts/service-worker-template.js", "utf8");
  const api = runInNewContext(source + "\n({ audioRange, serveAudio, navigation, staticAsset, cacheShell, chapterData });", context);
  return { api, self, handlers, caches, cache, fetch };
}

describe("offline audio and app updates", () => {
  it("serves closed, open-ended, suffix and clamped ranges from the full download", async () => {
    const { api } = worker();
    for (const [range, expected, contentRange] of [["bytes=1-3", "bcd", "bytes 1-3/6"], ["bytes=3-", "def", "bytes 3-5/6"], ["bytes=-2", "ef", "bytes 4-5/6"], ["bytes=4-999", "ef", "bytes 4-5/6"]]) {
      const r = await api.audioRange(new Response("abcdef", { headers: { "Content-Type": "audio/mpeg" } }), range);
      expect(r.status).toBe(206); expect(await r.text()).toBe(expected);
      expect(r.headers.get("Content-Range")).toBe(contentRange);
    }
  });
  it("rejects invalid and unsatisfiable ranges", async () => {
    for (const range of ["bytes=9-", "bytes=4-2", "bytes=-0", "bytes=", "bytes=0-1,3-4"]) {
      const response = await worker().api.audioRange(new Response("abcdef"), range);
      expect(response.status).toBe(416); expect(response.headers.get("Content-Range")).toBe("bytes */6");
    }
  });
  it("streams undownloaded audio with the original browser Range request", async () => {
    const { api, fetch } = worker(); const request = new Request("https://gita.test/audio/1.1.mp3", { headers: { Range: "bytes=0-2" } });
    fetch.mockResolvedValue(new Response("abc", { status: 206 }));
    await api.serveAudio(request); expect(fetch).toHaveBeenCalledWith(request);
  });
  it("plays downloaded audio while offline without a network call", async () => {
    const { api, cache, fetch } = worker(); cache.match.mockResolvedValue(new Response("abcdef"));
    const response = await api.serveAudio(new Request("https://gita.test/audio/1.1.mp3", { headers: { Range: "bytes=0-1" } }));
    expect(await response.text()).toBe("ab"); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not replace a live worker until the learner accepts an update", async () => {
    const { handlers, self } = worker();
    handlers.get("message")!({ data: { type: "OTHER" } }); expect(self.skipWaiting).not.toHaveBeenCalled();
    handlers.get("message")!({ data: { type: "SKIP_WAITING" } }); expect(self.skipWaiting).toHaveBeenCalledOnce();
  });
  it("preserves audio downloads and unrelated caches during activation", async () => {
    const { handlers, caches } = worker(); let work: Promise<void> | undefined;
    handlers.get("activate")!({ waitUntil: (p: Promise<void>) => { work = p; } }); await work;
    expect(caches.delete.mock.calls.map((c) => c[0])).toEqual(["gita-shell-v5"]);
  });
  it("falls back to the cached page offline but never serves HTML as a script", async () => {
    const { api, cache, fetch } = worker(); fetch.mockRejectedValue(new Error("Offline")); cache.match.mockResolvedValue(new Response("app shell"));
    expect(await (await api.navigation(new Request("https://gita.test/"))).text()).toBe("app shell");
    cache.match.mockResolvedValue(undefined);
    await expect(api.staticAsset(new Request("https://gita.test/_next/static/missing.js"))).rejects.toThrow("Offline");
  });
  it("precaches the HTML's scripts, styles and fonts for a first offline launch", async () => {
    const { api, fetch, cache } = worker();
    fetch.mockResolvedValue(new Response('<script src="/_next/static/app.js"></script><link href="/_next/static/style.css"><link href="/_next/static/font.woff2">'));
    await api.cacheShell();
    expect(cache.addAll.mock.calls[0][0]).toEqual(expect.arrayContaining(["/_next/static/app.js", "/_next/static/style.css", "/_next/static/font.woff2"]));
  });
  it("installs only the app shell: no chapter or purport is fetched during install", async () => {
    const { handlers, fetch, cache } = worker();
    fetch.mockImplementation(async (input: Request | string) => new Response(String(typeof input === "string" ? input : input.url).includes("/_next/static/") ? "" : '<script src="/_next/static/app.js"></script>'));
    let work: Promise<void> | undefined;
    handlers.get("install")!({ waitUntil: (p: Promise<void>) => { work = p; } }); await work;
    const requested = [...fetch.mock.calls.map((c) => String(c[0]?.url ?? c[0])), ...cache.addAll.mock.calls.flatMap((c) => c[0] as string[]), ...cache.add.mock.calls.map((c) => String(c[0]))];
    expect(requested.filter((u) => /\/api\//.test(u))).toEqual([]);
    expect(cache.add).not.toHaveBeenCalled();
  });
  it("keeps the shell small: only a handful of precache entries", async () => {
    const { api, fetch, cache } = worker();
    fetch.mockResolvedValue(new Response('<script src="/_next/static/a.js"></script>'));
    await api.cacheShell();
    expect(cache.addAll.mock.calls[0][0].length).toBeLessThan(20);
  });
  it("saves a chapter on first use, and serves it offline under a single key", async () => {
    const { api, fetch, cache } = worker();
    fetch.mockResolvedValueOnce(new Response("[1]", { status: 200 }));
    await api.chapterData(new Request("https://gita.test/api/chapters/2?cache-bust=123"));
    expect(cache.put.mock.calls[0][0].url).toBe("https://gita.test/api/chapters/2");
    fetch.mockRejectedValueOnce(new Error("Offline")); cache.match.mockResolvedValueOnce(new Response("[1]"));
    expect(await (await api.chapterData(new Request("https://gita.test/api/chapters/2?other=1"))).text()).toBe("[1]");
    expect(cache.match.mock.calls.at(-1)![0].url).toBe("https://gita.test/api/chapters/2");
  });
  it("never saves an error response, and reports an unsaved chapter as offline", async () => {
    const { api, fetch, cache } = worker();
    fetch.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect((await api.chapterData(new Request("https://gita.test/api/purports/3"))).status).toBe(500);
    expect(cache.put).not.toHaveBeenCalled();
    fetch.mockRejectedValueOnce(new Error("Offline")); cache.match.mockResolvedValueOnce(undefined);
    expect((await api.chapterData(new Request("https://gita.test/api/purports/3"))).status).toBe(504);
  });
  it("gives up on a stalled network after the timeout and uses the saved copy", async () => {
    vi.useFakeTimers();
    try {
      const { api, fetch, cache } = worker();
      fetch.mockImplementation((_: unknown, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
      cache.match.mockResolvedValue(new Response("[saved]"));
      const pending = api.chapterData(new Request("https://gita.test/api/chapters/4"));
      await vi.advanceTimersByTimeAsync(4100);
      expect(await (await pending).text()).toBe("[saved]");
    } finally { vi.useRealTimers(); }
  });
  it("answers a range from a large download without copying the whole file", async () => {
    const big = new Uint8Array(3_000_000).fill(7);
    const r = await worker().api.audioRange(new Response(big, { headers: { "Content-Type": "audio/mpeg" } }), "bytes=2999990-");
    expect(r.status).toBe(206); expect(r.headers.get("Content-Length")).toBe("10"); expect(r.headers.get("Content-Range")).toBe("bytes 2999990-2999999/3000000");
    expect((await r.arrayBuffer()).byteLength).toBe(10);
  });
  it("does not cut off a slow body download once the response has started", async () => {
    vi.useFakeTimers();
    try {
      const { api, fetch, cache } = worker();
      let signal: AbortSignal | undefined;
      fetch.mockImplementation(async (_: unknown, init?: { signal?: AbortSignal }) => { signal = init?.signal; return new Response("[slow but whole]"); });
      cache.put.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 6000))); // saving reads the whole body, like a slow connection
      const pending = api.chapterData(new Request("https://gita.test/api/purports/2"));
      await vi.advanceTimersByTimeAsync(6100);
      const response = await pending;
      expect(signal?.aborted).toBe(false);
      expect(await response.text()).toBe("[slow but whole]");
    } finally { vi.useRealTimers(); }
  });
});
