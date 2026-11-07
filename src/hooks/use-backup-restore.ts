import { useEffect, useRef, useState } from "react";
import { localDateIso } from "@/lib/constants";
import { loadState, saveState } from "@/lib/learning-progress";
import { mergeProgress } from "@/lib/progress-sync";
import { localKV, progressStoreFor, touchMeta } from "@/lib/progress-store";
import { PROFILE_STORAGE_KEY } from "./use-profile";
import { profileSchema } from "@/lib/schemas";
import { createBackup, readBackup, mergeProfiles, LearningBackup } from "@/lib/backup";

export function useBackupRestore(uid: string | null) {
  const [candidate, setCandidate] = useState<LearningBackup | null>(null);
  const [message, setMessage] = useState("");
  const uidRef = useRef(uid);
  uidRef.current = uid;
  useEffect(() => { setCandidate(null); setMessage(""); }, [uid]);
  const readProfile = (id: string) => profileSchema.parse(JSON.parse(localStorage.getItem(`${PROFILE_STORAGE_KEY}:${id}`) ?? '{"customName":null,"favorites":[]}'));

  const handleExportBackup = () => {
    if (!uid) return;
    try {
      const loaded = loadState(progressStoreFor(localKV, uid));
      if (loaded.status === "invalid") throw new Error("Saved progress could not be read. Your recovery copy is preserved.");
      const url = URL.createObjectURL(new Blob([JSON.stringify(createBackup(loaded.state, readProfile(uid)), null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `gita-108-backup-${localDateIso()}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup exported with favourites, revision dates and line timings.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not export backup."); }
  };

  const handleImportBackup = () => {
    if (!uid) return;
    const owner = uid;
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        if (file.size > 2_000_000) throw new Error("Choose a backup smaller than 2 MB.");
        const next = readBackup(await file.text());
        if (owner !== uidRef.current) return;
        setCandidate(next); setMessage("");
      } catch (e) { if (owner === uidRef.current) setMessage(e instanceof Error ? e.message : "Could not read backup."); }
    };
    input.click();
  };

  const confirmRestore = (mode: "merge" | "replace") => {
    if (!uid || !candidate) return;
    try {
      const store = progressStoreFor(localKV, uid);
      const current = loadState(store);
      if (current.status === "invalid") throw new Error("Current progress needs recovery before importing.");
      const profile = readProfile(uid);
      localStorage.setItem(`gita-before-restore:${uid}`, JSON.stringify(createBackup(current.state, profile)));
      const next = mode === "merge" ? mergeProgress(current.state, candidate.progress) : candidate.progress;
      const nextProfile = mode === "merge" ? mergeProfiles(profile, candidate.profile) : candidate.profile ?? profile;
      const oldMeta = store.readMeta();
      try {
        localStorage.setItem(`${PROFILE_STORAGE_KEY}:${uid}`, JSON.stringify(nextProfile));
        saveState(store, next);
        store.writeMeta(touchMeta(oldMeta, Date.now()));
      } catch (e) {
        localStorage.setItem(`${PROFILE_STORAGE_KEY}:${uid}`, JSON.stringify(profile));
        saveState(store, current.state); store.writeMeta(oldMeta); throw e;
      }
      window.location.reload();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not restore backup."); }
  };

  return { candidate, cancelRestore: () => setCandidate(null), confirmRestore, message, handleExportBackup, handleImportBackup };
}
