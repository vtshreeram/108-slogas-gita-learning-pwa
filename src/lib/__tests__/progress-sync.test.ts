import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { initialState, markAsLearned, markStep, undoLearned, deriveStats, saveState } from "@/lib/learning-progress";
import { SHLOKAS } from "@/lib/shlokas";
import { createMemoryKV, loadForUser, progressStoreFor, touchMeta, CLAIM_KEY, SyncMeta } from "@/lib/progress-store";
import { mergeProgress, reconcile, createProgressSync, RemoteProgress, RemoteSnapshot } from "@/lib/progress-sync";

const D1 = "2026-04-09";
const D2 = "2026-04-10";
const id = (i: number) => SHLOKAS[i].id;
const learned = (n: number, today = D1) => {
  let s = initialState(today);
  for (let i = 0; i < n; i++) s = markAsLearned(s, id(i));
  return s;
};

describe("per-user store and adoption", () => {
  it("first account adopts legacy progress; the second does not", () => {
    const kv = createMemoryKV({ [STORAGE_KEY]: JSON.stringify(learned(3)) });
    const a = loadForUser(kv, "alice", D1);
    expect(a.adopted).toBe(true);
    expect(deriveStats(a.state).completedCount).toBe(3);
    expect(kv.get(CLAIM_KEY)).toBe("alice");
    expect(kv.get(STORAGE_KEY)).not.toBeNull(); // legacy copy left in place

    const b = loadForUser(kv, "bob", D1);
    expect(b.adopted).toBe(false);
    expect(deriveStats(b.state).completedCount).toBe(0);
  });

  it("keeps users separate and reloads each one's own progress", () => {
    const kv = createMemoryKV();
    saveState(progressStoreFor(kv, "alice"), learned(2));
    saveState(progressStoreFor(kv, "bob"), learned(5));
    expect(deriveStats(loadForUser(kv, "alice", D1).state).completedCount).toBe(2);
    expect(deriveStats(loadForUser(kv, "bob", D1).state).completedCount).toBe(5);
  });

  it("does not adopt unreadable legacy data and does not claim", () => {
    const kv = createMemoryKV({ [STORAGE_KEY]: "{bad" });
    const a = loadForUser(kv, "alice", D1);
    expect(a.adopted).toBe(false);
    expect(kv.get(CLAIM_KEY)).toBeNull();
  });

  it("stashes a user's corrupt data under that user's key", () => {
    const kv = createMemoryKV();
    progressStoreFor(kv, "alice").write("{nope");
    expect(loadForUser(kv, "alice", D1).status).toBe("invalid");
    expect(kv.get(`${STORAGE_KEY}-corrupt:alice`)).toBe("{nope");
  });

  it("round-trips sync metadata", () => {
    const store = progressStoreFor(createMemoryKV(), "alice");
    expect(store.readMeta()).toEqual({ updatedAt: 0, linked: false });
    store.writeMeta({ updatedAt: 42, linked: true });
    expect(store.readMeta()).toEqual({ updatedAt: 42, linked: true });
  });
});

describe("mergeProgress", () => {
  it("unions completed steps and never loses any", () => {
    const a = markStep(initialState(D1), id(0), "listen", D1);
    const b = markStep(initialState(D1), id(0), "repeat", D1);
    const m = mergeProgress(a, b);
    expect(m.completed[id(0)]).toMatchObject({ listen: true, repeat: true });
    const both = mergeProgress(learned(2), learned(4));
    expect(deriveStats(both).completedCount).toBe(4);
  });

  it("takes max of recall counters, not the sum", () => {
    const a = { ...initialState(D1), recallAttempts: 5, recallWins: 4 };
    const b = { ...initialState(D1), recallAttempts: 3, recallWins: 3 };
    const m = mergeProgress(a, b);
    expect(m.recallAttempts).toBe(5);
    expect(m.recallWins).toBe(4);
  });

  it("streak follows the copy that practiced last; earliest start wins", () => {
    const a = { ...initialState("2026-03-01"), lastPracticeDate: D1, streakCount: 3 };
    const b = { ...initialState("2026-03-05"), lastPracticeDate: D2, streakCount: 7 };
    const m = mergeProgress(a, b);
    expect(m.streakCount).toBe(7);
    expect(m.lastPracticeDate).toBe(D2);
    expect(m.startedAt).toBe("2026-03-01");
  });

  it("position comes from the copy with more progress", () => {
    const a = { ...learned(1), activeIndex: 0 };
    const b = { ...learned(6), activeIndex: 6 };
    expect(mergeProgress(a, b).activeIndex).toBe(6);
  });
});

describe("reconcile", () => {
  const meta = (updatedAt: number, linked = true): SyncMeta => ({ updatedAt, linked });
  const snap = (state = initialState(D1), updatedAt = 0): RemoteSnapshot => ({ state, updatedAt });

  it("pushes when the cloud has nothing", () => {
    const d = reconcile({ state: learned(1), meta: meta(5, false) }, null, 100);
    expect(d).toMatchObject({ push: true, applyLocally: false, updatedAt: 5 });
  });

  it("first sync merges both and publishes the union", () => {
    const d = reconcile({ state: learned(2), meta: meta(0, false) }, snap(learned(4), 50), 100);
    expect(deriveStats(d.state).completedCount).toBe(4);
    expect(d).toMatchObject({ push: true, applyLocally: true, updatedAt: 100 });
  });

  it("newer remote wins and is not pushed back", () => {
    const d = reconcile({ state: learned(1), meta: meta(10) }, snap(learned(3), 20), 100);
    expect(deriveStats(d.state).completedCount).toBe(3);
    expect(d).toMatchObject({ push: false, applyLocally: true, updatedAt: 20 });
  });

  it("newer local is pushed; an undo propagates", () => {
    const d = reconcile({ state: learned(0), meta: meta(30) }, snap(learned(3), 20), 100);
    expect(d).toMatchObject({ push: true, applyLocally: false });
    expect(deriveStats(d.state).completedCount).toBe(0);
  });

  it("equal timestamps do nothing", () => {
    expect(reconcile({ state: learned(1), meta: meta(10) }, snap(learned(1), 10), 100)).toMatchObject({ push: false, applyLocally: false });
  });
});

function fakeRemote(initial: RemoteSnapshot | null = null) {
  let data = initial;
  const calls = { pull: 0, push: 0 };
  let failNext = false;
  const remote: RemoteProgress = {
    async pull() { calls.pull++; if (failNext) { failNext = false; throw new Error("offline"); } return data; },
    async push(_uid, s) { calls.push++; if (failNext) { failNext = false; throw new Error("offline"); } data = s; },
  };
  return { remote, calls, get data() { return data; }, failOnce: () => { failNext = true; } };
}

describe("createProgressSync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function harness(initialLocal: SyncMeta, state = learned(1), remote = fakeRemote()) {
    const local = { state, meta: initialLocal };
    const sync = createProgressSync({
      uid: "u", remote: remote.remote, debounceMs: 1000, now: () => 1000,
      getLocal: () => local,
      apply: (s, m) => { local.state = s; local.meta = m; },
      setMeta: (m) => { local.meta = m; },
    });
    return { local, sync, remote };
  }

  it("first sync with an empty cloud publishes and marks linked", async () => {
    const h = harness({ updatedAt: 7, linked: false });
    await h.sync.syncNow();
    expect(h.remote.calls.push).toBe(1);
    expect(h.local.meta).toEqual({ updatedAt: 7, linked: true });
    expect(deriveStats(h.remote.data!.state).completedCount).toBe(1);
  });

  it("applies a newer cloud copy without pushing", async () => {
    const remote = fakeRemote({ state: learned(5), updatedAt: 500 });
    const h = harness({ updatedAt: 100, linked: true }, learned(1), remote);
    await h.sync.syncNow();
    expect(deriveStats(h.local.state).completedCount).toBe(5);
    expect(remote.calls.push).toBe(0);
  });

  it("debounces pushes after edits into one write", async () => {
    const h = harness({ updatedAt: 100, linked: true }, learned(1), fakeRemote({ state: learned(1), updatedAt: 100 }));
    h.local.meta = { updatedAt: 200, linked: false };
    h.sync.markDirty(); h.sync.markDirty(); h.sync.markDirty();
    expect(h.remote.calls.pull).toBe(0);
    await vi.advanceTimersByTimeAsync(1100);
    expect(h.remote.calls.push).toBe(1);
    expect(h.local.meta.linked).toBe(true);
  });

  it("keeps the edit when the push fails and retries on the next trigger", async () => {
    const remote = fakeRemote({ state: learned(1), updatedAt: 100 });
    const h = harness({ updatedAt: 200, linked: false }, learned(2), remote);
    h.local.meta = { updatedAt: 200, linked: true }; // linked device with a newer local edit
    remote.failOnce();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await h.sync.syncNow(); // pull fails
    warn.mockRestore();
    expect(remote.data!.updatedAt).toBe(100);
    await h.sync.syncNow(); // retry succeeds
    expect(remote.data!.updatedAt).toBe(200);
    expect(deriveStats(remote.data!.state).completedCount).toBe(2);
  });

  it("does not overwrite the cloud when it cannot be read", async () => {
    const remote = fakeRemote({ state: learned(5), updatedAt: 500 });
    const h = harness({ updatedAt: 1, linked: false }, learned(0), remote);
    remote.failOnce();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await h.sync.syncNow();
    warn.mockRestore();
    expect(remote.calls.push).toBe(0);
    expect(deriveStats(remote.data!.state).completedCount).toBe(5);
  });

  it("stops after dispose", async () => {
    const h = harness({ updatedAt: 1, linked: false });
    h.sync.dispose();
    h.sync.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    await h.sync.syncNow();
    expect(h.remote.calls.pull).toBe(0);
  });

  it("an undo on a linked device reaches the cloud and is not merged back (real hook path)", async () => {
    const full = learned(3);
    const remote = fakeRemote({ state: full, updatedAt: 100 });
    const h = harness({ updatedAt: 100, linked: true }, full, remote);
    // what the hook does on an undo: touchMeta + transition
    h.local.meta = touchMeta(h.local.meta, 500);
    h.local.state = undoLearned(h.local.state, id(0));
    await h.sync.syncNow();
    expect(deriveStats(remote.data!.state).completedCount).toBe(2);
    expect(deriveStats(h.local.state).completedCount).toBe(2);
    expect(h.local.meta.linked).toBe(true);
  });

  it("a merge links the device, so later edits use newest-wins", async () => {
    const remote = fakeRemote({ state: learned(3), updatedAt: 100 });
    const h = harness({ updatedAt: 0, linked: false }, learned(1), remote);
    await h.sync.syncNow();
    expect(h.local.meta.linked).toBe(true);
    h.local.meta = touchMeta(h.local.meta, 5000);
    h.local.state = undoLearned(h.local.state, id(0));
    await h.sync.syncNow();
    expect(deriveStats(remote.data!.state).completedCount).toBe(2);
  });

  it("pushes an empty cloud exactly once", async () => {
    const h = harness({ updatedAt: 0, linked: false }, learned(1));
    await h.sync.syncNow();
    expect(h.remote.calls.push).toBe(1);
  });
});

describe("touchMeta", () => {
  it("advances updatedAt monotonically and keeps linked", () => {
    expect(touchMeta({ updatedAt: 10, linked: true }, 5)).toEqual({ updatedAt: 11, linked: true });
    expect(touchMeta({ updatedAt: 10, linked: false }, 99)).toEqual({ updatedAt: 99, linked: false });
  });
});
