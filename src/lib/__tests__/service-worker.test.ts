import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const cache = { match: vi.fn(), put: vi.fn(), addAll: vi.fn() };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ["other-app", "gita-shell-v5", "gita-shell-__RELEASE__", "gita-audio-v3"]), delete: vi.fn() };
  const self = { addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn), skipWaiting: vi.fn(), clients: { claim: vi.fn() }, location: { origin: "https://gita.test" } };
  const fetch = vi.fn();
  const context = { self, caches, fetch, Response, Request, URL, AbortController, setTimeout, clearTimeout };
  const source = readFileSync("scripts/service-worker-template.js", "utf8");
  const api = runInNewContext(source + "\n({ audioRange, serveAudio, navigation, staticAsset, cacheShell });", context);
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
});
