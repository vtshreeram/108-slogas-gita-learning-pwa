/**
 * Per-user progress storage on top of a key/value seam (localStorage in the
 * app, in-memory in tests). Also handles one-time adoption of the legacy
 * shared key by the first account that signs in on a device.
 */
import { STORAGE_KEY } from "@/lib/constants";
import { LoadResult, ProgressStorage, loadState, parseState, saveState } from "@/lib/learning-progress";

export type KV = { get(key: string): string | null; set(key: string, value: string): void };

export const localKV: KV = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
};

export function createMemoryKV(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    get: (k: string) => (k in data ? data[k] : null),
    set: (k: string, v: string) => { data[k] = v; },
    dump: () => ({ ...data }),
  };
}

/**
 * `updatedAt`: time of the last user edit (device clock).
 * `linked`: this device has been reconciled with the account's cloud copy at least once.
 * Before that, the first sync merges; after it, newest-wins is safe (and undo propagates).
 */
export type SyncMeta = { updatedAt: number; linked: boolean };

/** Meta after a user edit: advances `updatedAt` only, never touches `linked`. */
export const touchMeta = (meta: SyncMeta, now: number): SyncMeta => ({
  updatedAt: Math.max(now, meta.updatedAt + 1),
  linked: meta.linked,
});

export type ProgressStore = ProgressStorage & {
  stashCorrupt(raw: string): void;
  readMeta(): SyncMeta;
  writeMeta(meta: SyncMeta): void;
};

export const userKey = (base: string, uid: string) => `${base}:${uid}`;
/** Marker: which uid adopted the legacy shared progress (it is adopted at most once). */
export const CLAIM_KEY = `${STORAGE_KEY}-claimed-by`;

export function progressStoreFor(kv: KV, uid: string): ProgressStore {
  const key = userKey(STORAGE_KEY, uid);
  const metaKey = userKey(`${STORAGE_KEY}-meta`, uid);
  return {
    read: () => kv.get(key),
    write: (v) => kv.set(key, v),
    stashCorrupt: (raw) => kv.set(userKey(`${STORAGE_KEY}-corrupt`, uid), raw),
    readMeta: () => {
      try {
        const m = JSON.parse(kv.get(metaKey) ?? "null");
        if (m && typeof m.updatedAt === "number") return { updatedAt: m.updatedAt, linked: Boolean(m.linked) };
      } catch { /* fall through */ }
      return { updatedAt: 0, linked: false };
    },
    writeMeta: (m) => kv.set(metaKey, JSON.stringify(m)),
  };
}

export type UserLoad = LoadResult & { adopted: boolean };

/** Load a user's progress; the first user on a device inherits the legacy shared copy. */
export function loadForUser(kv: KV, uid: string, today?: string): UserLoad {
  const store = progressStoreFor(kv, uid);
  if (store.read() !== null) return { ...loadState(store, today), adopted: false };

  const legacy = kv.get(STORAGE_KEY);
  if (legacy && !kv.get(CLAIM_KEY)) {
    let json: unknown = null;
    try { json = JSON.parse(legacy); } catch { /* invalid: do not adopt */ }
    const parsed = parseState(json, today);
    if (parsed.ok) {
      saveState(store, parsed.state);
      kv.set(CLAIM_KEY, uid); // legacy key itself is left in place
      return { state: parsed.state, status: "loaded", adopted: true };
    }
  }
  return { ...loadState(store, today), adopted: false };
}
