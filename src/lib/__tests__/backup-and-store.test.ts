import { describe, it, expect } from "vitest";
import { SHLOKAS } from "@/lib/shlokas";
import { STORAGE_KEY } from "@/lib/constants";
import { initialState, markAsLearned } from "@/lib/learning-progress";
import { createBackup, readBackup, mergeProfiles } from "@/lib/backup";
import { CLAIM_KEY, createMemoryKV, loadForUser, progressStoreFor } from "@/lib/progress-store";

const TODAY = "2026-04-10";
const profile = { customName: null, favorites: [], lineCues: {} };

describe("readBackup", () => {
  it("round-trips a full backup", () => {
    const progress = markAsLearned(initialState(TODAY), SHLOKAS[0].id, TODAY);
    const back = readBackup(JSON.stringify(createBackup(progress, profile)));
    expect(back.progress.completed[SHLOKAS[0].id]?.recall).toBe(true);
    expect(back.profile).toEqual(profile);
  });
  it("accepts the original progress-only format", () => {
    expect(readBackup(JSON.stringify(initialState(TODAY))).profile).toBeUndefined();
  });
  it("rejects invalid JSON, oversized files and bad progress", () => {
    expect(() => readBackup("{nope")).toThrow(/not valid JSON/);
    expect(() => readBackup(" ".repeat(2_000_001))).toThrow(/too large/);
    expect(() => readBackup(JSON.stringify({ kind: "gita108", version: 1, exportedAt: "x", progress: { bad: true } }))).toThrow(/Invalid progress/);
  });
  it("rejects a backup whose profile is malformed", () => {
    expect(() => readBackup(JSON.stringify({ kind: "gita108", version: 1, exportedAt: "x", progress: initialState(TODAY), profile: { favorites: 5 } }))).toThrow(/invalid/);
  });
});

describe("mergeProfiles", () => {
  it("keeps the local name and local line cues over the backup's", () => {
    const local = { customName: "Asha", favorites: [], lineCues: { [SHLOKAS[0].id]: [0, 1] } };
    const incoming = { customName: "Other", favorites: [], lineCues: { [SHLOKAS[0].id]: [0, 9], [SHLOKAS[1].id]: [0, 2] } };
    const merged = mergeProfiles(local, incoming);
    expect(merged.customName).toBe("Asha");
    expect(merged.lineCues[SHLOKAS[0].id]).toEqual([0, 1]);
    expect(merged.lineCues[SHLOKAS[1].id]).toEqual([0, 2]);
  });
  it("returns the local profile when there is no incoming one", () => {
    expect(mergeProfiles(profile)).toBe(profile);
  });
});

describe("loadForUser legacy adoption", () => {
  const legacy = JSON.stringify(markAsLearned(initialState(TODAY), SHLOKAS[0].id, TODAY));
  it("lets the first account adopt the shared copy exactly once", () => {
    const kv = createMemoryKV({ [STORAGE_KEY]: legacy });
    const first = loadForUser(kv, "a", TODAY);
    expect(first.adopted).toBe(true);
    expect(kv.get(CLAIM_KEY)).toBe("a");
    const second = loadForUser(kv, "b", TODAY);
    expect(second.adopted).toBe(false);
    expect(second.status).toBe("fresh");
  });
  it("does not adopt unreadable legacy data and keeps accounts separate", () => {
    const kv = createMemoryKV({ [STORAGE_KEY]: "{bad" });
    expect(loadForUser(kv, "a", TODAY).adopted).toBe(false);
    expect(kv.get(CLAIM_KEY)).toBeNull();
    progressStoreFor(kv, "a").write(legacy);
    expect(loadForUser(kv, "b", TODAY).status).toBe("fresh");
  });
});
