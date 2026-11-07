import { app } from "@/lib/firebase";
import { parseState } from "@/lib/learning-progress";
import type { RemoteProgress } from "@/lib/progress-sync";

/** NEXT_PUBLIC_ vars are inlined at build time: changing this needs a redeploy. */
export const SYNC_ENABLED = process.env.NEXT_PUBLIC_PROGRESS_SYNC === "1";

const COLLECTION = "progress";

/** Firestore adapter. firebase/firestore is imported lazily so it stays out of the bundle when sync is off. */
export function createFirestoreRemote(): RemoteProgress | null {
  if (!SYNC_ENABLED) return null;
  const open = async () => {
    const fs = await import("firebase/firestore");
    return { fs, db: fs.getFirestore(app) };
  };
  return {
    async pull(uid) {
      const { fs, db } = await open();
      const snap = await fs.getDoc(fs.doc(db, COLLECTION, uid));
      if (!snap.exists()) return null;
      const data = snap.data();
      const parsed = parseState(JSON.parse(String(data.state)));
      // An unreadable cloud copy throws, so it is never overwritten by a push.
      if (!parsed.ok) throw new Error(`Cloud progress is invalid: ${parsed.error}`);
      return { state: parsed.state, updatedAt: Number(data.updatedAt) || 0 };
    },
    async push(uid, snapshot) {
      const { fs, db } = await open();
      await fs.setDoc(fs.doc(db, COLLECTION, uid), {
        state: JSON.stringify(snapshot.state),
        updatedAt: snapshot.updatedAt,
      });
    },
  };
}
