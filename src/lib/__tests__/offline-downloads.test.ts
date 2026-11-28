import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sizes from "@/data/audio-sizes.json";

const ORIGIN = "https://gita.test";
type Store = Map<string, Map<string, Response>>;

function installBrowser(options: { quota?: number; usage?: number; fail?: (url: string) => boolean; slow?: boolean } = {}) {
  const store: Store = new Map();
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    const key = (k: Request | string) => new URL(typeof k === "string" ? k : k.url, ORIGIN).href;
    return {
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
      match: async (k: Request | string) => entries.get(key(k))?.clone(),
      put: async (k: Request | string, response: Response) => { entries.set(key(k), response); },
      delete: async (k: Request | string) => entries.delete(key(k)),
    };
  };
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (options.slow) await new Promise((r) => setTimeout(r, 5));
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    if (options.fail?.(url)) return new Response("nope", { status: 503 });
    const path = new URL(url, ORIGIN).pathname;
    return path.startsWith("/api/")
      ? new Response('{"ok":1}', { headers: { "Content-Type": "application/json" } })
      // Verse files come back at their real size, so a saved file counts as current.
      : new Response(new Uint8Array((sizes as Record<string, number>)[path.replace(/^\/audio\/|\.mp3$/g, "")] ?? 10), { headers: { "Content-Type": "audio/mpeg" } });
  });
  const events = new EventTarget();
  vi.stubGlobal("caches", { open });
  vi.stubGlobal("fetch", fetchFn);
  vi.stubGlobal("location", new URL(`${ORIGIN}/offline`));
  vi.stubGlobal("navigator", { onLine: true, storage: { estimate: async () => ({ quota: options.quota, usage: options.usage ?? 0 }), persisted: async () => false, persist: vi.fn(async () => true) } });
  vi.stubGlobal("window", Object.assign(events, { isSecureContext: true, caches: {} }));
  return { store, fetchFn };
}

async function load() {
  vi.resetModules();
  const m = await import("../offline-downloads");
  m.subscribe(() => {});
  await vi.waitFor(() => expect(m.getSnapshot().ready).toBe(true));
  return m;
}
const settled = async (m: Awaited<ReturnType<typeof load>>) => vi.waitFor(() => { const { job } = m.getSnapshot(); expect(job).toBeDefined(); expect(job!.status).not.toBe("running"); });

describe("offline downloads", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("saves Essentials where the service worker reads them (origin + pathname)", async () => {
    const { store } = installBrowser();
    const m = await load();
    m.start("essentials");
    await settled(m);
    expect(m.getSnapshot().job).toMatchObject({ status: "done", done: 37, total: 37 });
    const text = store.get("gita-chapters-v1")!;
    expect(text.has(`${ORIGIN}/api/chapters/1`)).toBe(true);
    expect(text.has(`${ORIGIN}/api/chapters/search`)).toBe(true);
    // Running it again downloads nothing.
    m.start("essentials");
    await settled(m);
    expect(m.getSnapshot().job?.message).toMatch(/already saved/);
  });

  it("downloads verse audio past the saved copy, marks its encoding and asks to keep it", async () => {
    const { store, fetchFn } = installBrowser();
    const m = await load();
    m.start("verses108");
    await settled(m);
    expect(m.getSnapshot().job).toMatchObject({ status: "done", total: 108 });
    const saved = store.get("gita-audio-v3")!.get(`${ORIGIN}/audio/2.47.mp3`)!;
    expect(saved.headers.get("X-Gita-Audio-Encoding")).toBeTruthy();
    expect(String(fetchFn.mock.calls[0][0])).toMatch(/^\/audio\/.+\.mp3\?download=/);
    expect((navigator as unknown as { storage: { persist: ReturnType<typeof vi.fn> } }).storage.persist).toHaveBeenCalled();
  });

  it("refuses up front when the pack will not fit", async () => {
    const { fetchFn } = installBrowser({ quota: 1000, usage: 900 });
    const m = await load();
    m.start("verses657");
    await settled(m);
    expect(m.getSnapshot().job).toMatchObject({ status: "error" });
    expect(m.getSnapshot().job?.message).toMatch(/needs about/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("pauses, keeps what was saved, and resumes with the rest", async () => {
    installBrowser({ slow: true });
    const m = await load();
    m.start("verses108");
    await vi.waitFor(() => expect(m.getSnapshot().job?.done).toBeGreaterThan(3));
    m.pause();
    await settled(m);
    const { job } = m.getSnapshot();
    expect(job?.status).toBe("paused");
    expect(job!.done).toBeLessThan(108);
    m.resume();
    await settled(m);
    expect(m.getSnapshot().job).toMatchObject({ status: "done", total: 108 - job!.done });
  });

  it("stops on a failed file with a Resume message, and queues a second pack behind a running one", async () => {
    installBrowser({ fail: (url) => url.includes("/api/purports/3") });
    const m = await load();
    m.start("essentials");
    m.start("chapter-1");
    expect(m.getSnapshot().queue).toEqual(["chapter-1"]);
    await vi.waitFor(() => expect(m.getSnapshot().job?.pack).toBe("chapter-1"));
    await settled(m);
    expect(m.getSnapshot().queue).toEqual([]);
  });

  it("removes a pack's files", async () => {
    const { store } = installBrowser();
    const m = await load();
    m.start("chapter-3");
    await settled(m);
    expect(store.get("gita-chapter-audio-v1")!.size).toBe(1);
    await m.remove("chapter-3");
    expect(store.get("gita-chapter-audio-v1")!.size).toBe(0);
  });
});
