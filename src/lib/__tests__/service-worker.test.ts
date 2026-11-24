import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const NEXT_BUILD_ID = "fixture-build";
const REQUIRED_LAZY_ASSETS = ["/_next/static/chunks/reader.js", "/_next/static/chunks/profile.js"];

function pageHtml(content: string, build = NEXT_BUILD_ID) {
  const appRouterData = JSON.stringify(`0:${JSON.stringify({ P: null, b: build })}`);
  return `<!doctype html><script>self.__next_f.push([1,${appRouterData}])</script>${content}`;
}

function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const cache = { match: vi.fn(), put: vi.fn(), addAll: vi.fn(), add: vi.fn() };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ["other-app", "gita-shell-v5", "gita-shell-__RELEASE__", "gita-audio-v3"]), delete: vi.fn() };
  const self = { addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn), skipWaiting: vi.fn(), clients: { claim: vi.fn() }, location: { origin: "https://gita.test" } };
  const fetch = vi.fn();
  const context = { self, caches, fetch, Response, Request, URL, AbortController, Blob, setTimeout, clearTimeout };
  const source = readFileSync("scripts/service-worker-template.js", "utf8")
    .replaceAll("__NEXT_BUILD_ID__", JSON.stringify(NEXT_BUILD_ID))
    .replaceAll("__REQUIRED_LAZY_ASSETS__", JSON.stringify(REQUIRED_LAZY_ASSETS));
  const api = runInNewContext(source + "\n({ audioRange, serveAudio, cacheShell });", context);
  const request = (url: string, navigation = false) => {
    const req = new Request(url);
    if (navigation) Object.defineProperty(req, "mode", { value: "navigate" });
    let response: Promise<Response> | undefined;
    const tasks: Promise<unknown>[] = [];
    handlers.get("fetch")!({
      request: req,
      respondWith: (value: Promise<Response>) => { response = value; },
      waitUntil: (task: Promise<unknown>) => { tasks.push(task); },
    });
    return { response: response!, background: Promise.all(tasks) };
  };
  return { api, self, handlers, caches, cache, fetch, request };
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
    const { cache, fetch, request } = worker(); fetch.mockRejectedValue(new Error("Offline")); cache.match.mockResolvedValue(new Response("app shell"));
    expect(await (await request("https://gita.test/", true).response).text()).toBe("app shell");
    cache.match.mockResolvedValue(undefined);
    await expect(request("https://gita.test/_next/static/missing.js").response).rejects.toThrow("Offline");
  });
  it("serves a new script even when the offline shell cache is full", async () => {
    const { cache, fetch, request } = worker();
    fetch.mockResolvedValue(new Response("script from the network"));
    cache.put.mockRejectedValue(new Error("Storage quota exceeded"));
    const script = request("https://gita.test/_next/static/new.js");
    expect(await (await script.response).text()).toBe("script from the network");
    await script.background;
    expect(cache.put).toHaveBeenCalledOnce();
  });
  it("precaches the HTML assets and required lazy chunks for a first offline launch", async () => {
    const { api, fetch, cache } = worker();
    fetch.mockResolvedValue(new Response(pageHtml('<script src="/_next/static/app.js"></script><link href="/_next/static/style.css"><link href="/_next/static/font.woff2">')));
    await api.cacheShell();
    expect(cache.addAll.mock.calls[0][0]).toEqual(expect.arrayContaining(["/_next/static/app.js", "/_next/static/style.css", "/_next/static/font.woff2", ...REQUIRED_LAZY_ASSETS]));
    expect(cache.put.mock.calls.map((call) => call[0])).toEqual(["/", "/profile", "/chapters"]);
  });
  it("keeps the profile page separate from the reader shell online and offline", async () => {
    const { request, fetch, cache } = worker();
    fetch.mockResolvedValueOnce(new Response(pageHtml("profile")));
    await request("https://gita.test/profile", true).background;
    expect(cache.put.mock.calls[0][0]).toBe("/profile");
    fetch.mockRejectedValue(new Error("offline"));
    cache.match.mockImplementation(async (path) => new Response(path === "/profile" ? "profile" : "reader"));
    expect(await (await request("https://gita.test/profile", true).response).text()).toBe("profile");
    expect(await (await request("https://gita.test/?verse=GS-001", true).response).text()).toBe("reader");
  });
  it("serves new navigation HTML while preparing all of its chunks for offline use", async () => {
    const { request, fetch, cache } = worker();
    const html = pageHtml('<script src="/_next/static/new.js"></script><link href="/_next/static/shared.css">');
    let finishChunks!: () => void;
    const chunksSaved = new Promise<void>((resolve) => { finishChunks = resolve; });
    fetch.mockResolvedValue(new Response(html));
    cache.match.mockImplementation(async (path) => path === "/_next/static/shared.css" ? new Response("") : undefined);
    cache.addAll.mockReturnValue(chunksSaved);

    const navigation = request("https://gita.test/profile", true);
    expect(await (await navigation.response).text()).toBe(html);
    expect(cache.put).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(cache.addAll).toHaveBeenCalledWith(["/_next/static/new.js"]));
    finishChunks();
    await navigation.background;
    expect(cache.put.mock.calls[0][0]).toBe("/profile");
    expect(await cache.put.mock.calls[0][1].text()).toBe(html);
  });
  it("keeps the previous offline page if the new release's chunks cannot be cached", async () => {
    const { request, fetch, cache } = worker();
    const html = pageHtml('<script src="/_next/static/new.js"></script>');
    fetch.mockResolvedValueOnce(new Response(html)).mockRejectedValue(new Error("Offline"));
    cache.addAll.mockRejectedValueOnce(new Error("Storage quota exceeded"));
    cache.match.mockImplementation(async (path) => path === "/profile" ? new Response("previous page") : undefined);

    const navigation = request("https://gita.test/profile", true);
    expect(await (await navigation.response).text()).toBe(html);
    await navigation.background;
    expect(cache.put).not.toHaveBeenCalled();
    expect(await (await request("https://gita.test/profile", true).response).text()).toBe("previous page");
  });
  it("serves a newer build online while preserving the active worker's offline page and chunks", async () => {
    const { request, fetch, cache } = worker();
    const html = pageHtml('<script src="/_next/static/other.js"></script>', "newer-build");
    fetch.mockResolvedValueOnce(new Response(html)).mockRejectedValue(new Error("Offline"));
    cache.match.mockResolvedValue(new Response(pageHtml("active build")));

    const navigation = request("https://gita.test/profile", true);
    expect(await (await navigation.response).text()).toBe(html);
    await navigation.background;
    expect(cache.addAll).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(await (await request("https://gita.test/profile", true).response).text()).toBe(pageHtml("active build"));
  });
  it("installs only the app shell: no chapter or purport is fetched during install", async () => {
    const { handlers, fetch, cache } = worker();
    fetch.mockImplementation(async () => new Response(pageHtml('<script src="/_next/static/app.js"></script>')));
    let work: Promise<void> | undefined;
    handlers.get("install")!({ waitUntil: (p: Promise<void>) => { work = p; } }); await work;
    const requested = [...fetch.mock.calls.map((c) => String(c[0]?.url ?? c[0])), ...cache.addAll.mock.calls.flatMap((c) => c[0] as string[]), ...cache.add.mock.calls.map((c) => String(c[0]))];
    expect(requested.filter((u) => /\/api\//.test(u))).toEqual([]);
    expect(cache.add).not.toHaveBeenCalled();
  });
  it("rejects installation if any shell document belongs to a different build", async () => {
    const { api, fetch, cache } = worker();
    fetch.mockResolvedValueOnce(new Response(pageHtml("reader")))
      .mockResolvedValueOnce(new Response(pageHtml("profile", "other-build")));
    await expect(api.cacheShell()).rejects.toThrow("The app shell changed during installation");
    expect(cache.addAll).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });
  it("keeps the shell small: only a handful of precache entries", async () => {
    const { api, fetch, cache } = worker();
    fetch.mockResolvedValue(new Response(pageHtml('<script src="/_next/static/a.js"></script>')));
    await api.cacheShell();
    expect(cache.addAll.mock.calls[0][0].length).toBeLessThan(20);
  });
  it("saves a chapter on first use, and serves it offline under a single key", async () => {
    const { request, fetch, cache } = worker();
    fetch.mockResolvedValueOnce(new Response("[1]", { status: 200 }));
    await request("https://gita.test/api/chapters/2?cache-bust=123").background;
    expect(cache.put.mock.calls[0][0].url).toBe("https://gita.test/api/chapters/2");
    fetch.mockRejectedValueOnce(new Error("Offline")); cache.match.mockResolvedValueOnce(new Response("[1]"));
    expect(await (await request("https://gita.test/api/chapters/2?other=1").response).text()).toBe("[1]");
    expect(cache.match.mock.calls.at(-1)![0].url).toBe("https://gita.test/api/chapters/2");
  });
  it("caches the static verse search index when requested", async () => {
    const { request, fetch, cache } = worker();
    fetch.mockResolvedValueOnce(new Response("[]"));
    const search = request("https://gita.test/api/chapters/search?cache-bust=123");
    expect(await (await search.response).text()).toBe("[]");
    await search.background;
    expect(cache.put.mock.calls[0][0].url).toBe("https://gita.test/api/chapters/search");
  });
  it("never saves an error response, and reports an unsaved chapter as offline", async () => {
    const { request, fetch, cache } = worker();
    fetch.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect((await request("https://gita.test/api/purports/3").response).status).toBe(500);
    expect(cache.put).not.toHaveBeenCalled();
    fetch.mockRejectedValueOnce(new Error("Offline")); cache.match.mockResolvedValueOnce(undefined);
    expect((await request("https://gita.test/api/purports/3").response).status).toBe(504);
  });
  it("serves a saved chapter immediately and bounds the background refresh", async () => {
    vi.useFakeTimers();
    try {
      const { request, fetch, cache } = worker();
      let signal: AbortSignal | undefined;
      fetch.mockImplementation((_: unknown, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
        signal = init?.signal;
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }));
      cache.match.mockResolvedValue(new Response("[saved]"));
      const chapter = request("https://gita.test/api/chapters/4");
      expect(await (await chapter.response).text()).toBe("[saved]");
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(4100);
      await chapter.background;
      expect(signal?.aborted).toBe(true);
      expect(cache.put).not.toHaveBeenCalled();
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
      const { request, fetch, cache } = worker();
      let signal: AbortSignal | undefined;
      fetch.mockImplementation(async (_: unknown, init?: { signal?: AbortSignal }) => { signal = init?.signal; return new Response("[slow but whole]"); });
      cache.match.mockResolvedValue(new Response("[saved]"));
      cache.put.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 6000))); // saving reads the whole body, like a slow connection
      const purport = request("https://gita.test/api/purports/2");
      expect(await (await purport.response).text()).toBe("[saved]");
      await vi.advanceTimersByTimeAsync(6100);
      await purport.background;
      expect(signal?.aborted).toBe(false);
      expect(await cache.put.mock.calls[0][1].text()).toBe("[slow but whole]");
    } finally { vi.useRealTimers(); }
  });
  it("serves an unsaved purport even if storing the fetched copy fails", async () => {
    const { request, fetch, cache } = worker();
    fetch.mockResolvedValue(new Response("[fresh]"));
    cache.put.mockRejectedValue(new Error("Storage quota exceeded"));
    const purport = request("https://gita.test/api/purports/2");
    expect(await (await purport.response).text()).toBe("[fresh]");
    await purport.background;
    expect(cache.put).toHaveBeenCalledOnce();
  });
  it("waits for a slow network when no copy is saved instead of reporting offline", async () => {
    vi.useFakeTimers();
    try {
      const { request, fetch, cache } = worker();
      cache.match.mockResolvedValue(undefined);
      cache.put.mockResolvedValue(undefined);
      fetch.mockImplementation((_: unknown, init?: { signal?: AbortSignal }) => new Promise((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        setTimeout(() => resolve(new Response("[late]")), 9000);
      }));
      const { response: pending } = request("https://gita.test/api/chapters/5");
      await vi.advanceTimersByTimeAsync(9100);
      const response = await pending;
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("[late]");
    } finally { vi.useRealTimers(); }
  });
  it("retries a failed shell download once before giving up", async () => {
    const { api, fetch } = worker();
    fetch.mockRejectedValueOnce(new Error("flaky")).mockResolvedValue(new Response(pageHtml("reader")));
    await expect(api.cacheShell()).resolves.toBeUndefined();
    fetch.mockReset(); fetch.mockRejectedValue(new Error("down"));
    await expect(api.cacheShell()).rejects.toThrow();
  });
});
