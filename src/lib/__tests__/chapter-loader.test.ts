import { describe, expect, it, vi } from "vitest";
import { createChapterLoader } from "../gita-verses";

const options = { url: (c: number) => `/api/chapters/${c}`, failure: (s: number) => `status ${s}`, offlineMessage: "offline" };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("chapter loader", () => {
  it("de-duplicates concurrent and repeated requests for the same chapter", async () => {
    const fetchImpl = vi.fn(async () => ok([1]));
    const load = createChapterLoader<number[]>({ ...options, fetchImpl });
    const [a, b] = await Promise.all([load(2), load(2)]);
    expect(a).toBe(b);
    await load(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never runs more than three requests at once, and still finishes them all", async () => {
    let running = 0, peak = 0;
    const fetchImpl = vi.fn(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; return ok([]); });
    const load = createChapterLoader<number[]>({ ...options, fetchImpl });
    await Promise.all(Array.from({ length: 18 }, (_, i) => load(i + 1)));
    expect(peak).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(18);
  });

  it("forgets a failed request so the next call retries, with a readable message", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response("", { status: 504 })).mockResolvedValueOnce(ok(["fresh"]));
    const load = createChapterLoader<string[]>({ ...options, fetchImpl });
    await expect(load(3)).rejects.toThrow("status 504");
    await expect(load(3)).resolves.toEqual(["fresh"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a network failure as the offline message and recovers when back online", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(ok(["back"]));
    const load = createChapterLoader<string[]>({ ...options, fetchImpl });
    await expect(load(4)).rejects.toThrow("offline");
    await expect(load(4)).resolves.toEqual(["back"]);
  });

  it("releases its slot after a failure so queued chapters are not stuck", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("x"); });
    const load = createChapterLoader<number[]>({ ...options, fetchImpl, concurrency: 1 });
    const results = await Promise.allSettled([load(1), load(2), load(3)]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("lets one caller stop waiting without cancelling the shared request", async () => {
    const fetchImpl = vi.fn(async () => { await new Promise((r) => setTimeout(r, 5)); return ok(["x"]); });
    const load = createChapterLoader<string[]>({ ...options, fetchImpl });
    const controller = new AbortController();
    const stale = load(5, controller.signal);
    controller.abort();
    await expect(stale).rejects.toMatchObject({ name: "AbortError" });
    await expect(load(5)).resolves.toEqual(["x"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects chapters outside 1–18 without a request", async () => {
    const fetchImpl = vi.fn();
    await expect(createChapterLoader({ ...options, fetchImpl })(19)).rejects.toThrow("Unknown chapter 19");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
