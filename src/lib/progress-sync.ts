/**
 * Cloud sync for Learning progress: pure merge/reconcile rules plus a small
 * controller. The only seam is `RemoteProgress` (Firestore in the app, a fake
 * in tests). Conflict rule: newest write wins; the first sync on a device
 * merges instead, so nothing local is lost when an account is first linked.
 */
import type { AppState } from "@/lib/constants";
import { fullDone } from "@/lib/constants";
import type { SyncMeta } from "@/lib/progress-store";

export type RemoteSnapshot = { state: AppState; updatedAt: number };

export type RemoteProgress = {
  pull(uid: string): Promise<RemoteSnapshot | null>;
  push(uid: string, snapshot: RemoteSnapshot): Promise<void>;
};

const doneCount = (s: AppState) => Object.values(s.completed).filter((p) => fullDone(p)).length;

/** Union of two progress copies; never loses a completed step. */
export function mergeProgress(local: AppState, remote: AppState): AppState {
  const completed: AppState["completed"] = {};
  for (const id of new Set([...Object.keys(local.completed), ...Object.keys(remote.completed)])) {
    const a = local.completed[id];
    const b = remote.completed[id];
    completed[id] = {
      listen: Boolean(a?.listen || b?.listen),
      repeat: Boolean(a?.repeat || b?.repeat),
      understand: Boolean(a?.understand || b?.understand),
      recall: Boolean(a?.recall || b?.recall),
    };
  }
  // Streak follows whichever copy practiced last (ISO dates compare as strings).
  let streakSide = local;
  if (remote.lastPracticeDate > local.lastPracticeDate) streakSide = remote;
  const streakCount =
    remote.lastPracticeDate === local.lastPracticeDate ? Math.max(local.streakCount, remote.streakCount) : streakSide.streakCount;
  // Preferences and position come from the copy with more progress (tie: local).
  const prefSide = doneCount(remote) > doneCount(local) ? remote : local;
  const recallAttempts = Math.max(local.recallAttempts, remote.recallAttempts);
  return {
    schemaVersion: local.schemaVersion,
    startedAt: local.startedAt < remote.startedAt ? local.startedAt : remote.startedAt,
    lastActiveDate: local.lastActiveDate > remote.lastActiveDate ? local.lastActiveDate : remote.lastActiveDate,
    lastPracticeDate: streakSide.lastPracticeDate,
    streakCount,
    activeMode: prefSide.activeMode,
    completed,
    recallAttempts,
    recallWins: Math.min(Math.max(local.recallWins, remote.recallWins), recallAttempts),
    activeIndex: prefSide.activeIndex,
    contentMode: prefSide.contentMode,
  };
}

export type Decision = {
  state: AppState;
  updatedAt: number;
  /** Replace local state with `state`. */
  applyLocally: boolean;
  /** Write `state` to the cloud. */
  push: boolean;
};

export function reconcile(local: { state: AppState; meta: SyncMeta }, remote: RemoteSnapshot | null, now: number): Decision {
  if (!remote) {
    return { state: local.state, updatedAt: local.meta.updatedAt || now, applyLocally: false, push: true };
  }
  if (!local.meta.synced) {
    // First sync of this device/account: merge, then publish the union.
    return { state: mergeProgress(local.state, remote.state), updatedAt: now, applyLocally: true, push: true };
  }
  if (remote.updatedAt > local.meta.updatedAt) {
    return { state: remote.state, updatedAt: remote.updatedAt, applyLocally: true, push: false };
  }
  if (local.meta.updatedAt > remote.updatedAt) {
    return { state: local.state, updatedAt: local.meta.updatedAt, applyLocally: false, push: true };
  }
  return { state: local.state, updatedAt: local.meta.updatedAt, applyLocally: false, push: false };
}

export type ProgressSyncOptions = {
  uid: string;
  remote: RemoteProgress;
  getLocal: () => { state: AppState; meta: SyncMeta };
  /** Replace local state and metadata with the reconciled result. */
  apply: (state: AppState, meta: SyncMeta) => void;
  /** Update metadata only (after a successful push). */
  setMeta: (meta: SyncMeta) => void;
  debounceMs?: number;
  now?: () => number;
};

export function createProgressSync(opts: ProgressSyncOptions) {
  const { uid, remote, getLocal, apply, setMeta } = opts;
  const debounceMs = opts.debounceMs ?? 1500;
  const now = opts.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;
  let rerun = false;
  let disposed = false;

  async function once() {
    const snapshot = await remote.pull(uid);
    if (disposed) return;
    const d = reconcile(getLocal(), snapshot, now());
    if (d.applyLocally) apply(d.state, { updatedAt: d.updatedAt, synced: d.push ? false : true });
    if (d.push) {
      await remote.push(uid, { state: d.state, updatedAt: d.updatedAt });
      if (disposed) return;
      // Only mark synced if the user did not edit while the push was in flight.
      if (getLocal().meta.updatedAt === d.updatedAt) setMeta({ updatedAt: d.updatedAt, synced: true });
      else rerun = true;
    }
  }

  /** Pull, reconcile, push if needed. Failures are kept for the next trigger (edit or `online`). */
  function syncNow(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (inflight) { rerun = true; return inflight; }
    inflight = (async () => {
      try {
        do {
          rerun = false;
          await once();
        } while (rerun && !disposed);
      } catch (e) {
        console.warn("Progress sync failed; will retry:", e);
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  /** Call after a user edit: pushes shortly after the last change. */
  function markDirty() {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void syncNow(); }, debounceMs);
  }

  function dispose() {
    disposed = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { syncNow, markDirty, dispose };
}
