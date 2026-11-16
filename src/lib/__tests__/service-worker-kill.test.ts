import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function killWorker(pages: { url: string; navigate: ReturnType<typeof vi.fn> }[]) {
  const handlers = new Map<string, (event: unknown) => void>();
  const caches = { keys: vi.fn(async () => ["gita-shell-abc", "gita-shell-old", "gita-audio-v3", "gita-chapters-v1", "other-app"]), delete: vi.fn<(key: string) => Promise<boolean>>(async () => true) };
  const order: string[] = [];
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn),
    skipWaiting: vi.fn(),
    clients: { matchAll: vi.fn(async () => { order.push("matchAll"); return pages; }) },
    registration: { unregister: vi.fn(async () => { order.push("unregister"); return true; }) },
  };
  runInNewContext(readFileSync("scripts/service-worker-kill.js", "utf8"), { self, caches });
  return { handlers, self, caches, order };
}

async function activate(handlers: Map<string, (event: unknown) => void>) {
  let done: Promise<unknown> = Promise.resolve();
  handlers.get("activate")!({ waitUntil: (p: Promise<unknown>) => { done = p; } });
  await done;
}

describe("emergency service worker (SW_KILL_SWITCH=1)", () => {
  it("takes over at once, intercepts nothing, and keeps the learner's downloads", async () => {
    const page = { url: "https://gita.test/", navigate: vi.fn(async () => null) };
    const { handlers, self, caches, order } = killWorker([page]);
    expect(handlers.has("fetch")).toBe(false);
    handlers.get("install")!({});
    expect(self.skipWaiting).toHaveBeenCalled();
    await activate(handlers);
    expect(caches.delete.mock.calls.map((c) => c[0])).toEqual(["gita-shell-abc", "gita-shell-old"]);
    expect(order).toEqual(["matchAll", "unregister"]);
    expect(page.navigate).toHaveBeenCalledWith("https://gita.test/");
  });

  it("does not reload anything on a fresh install, so there is no reload loop", async () => {
    const { handlers, self } = killWorker([]);
    await activate(handlers);
    expect(self.registration.unregister).toHaveBeenCalled();
  });

  it("is selected by the build script only when the switch is set", () => {
    const script = readFileSync("scripts/build-service-worker.mjs", "utf8");
    expect(script).toMatch(/process\.env\.SW_KILL_SWITCH === "1"/);
    expect(script).toContain("scripts/service-worker-kill.js");
  });
});
