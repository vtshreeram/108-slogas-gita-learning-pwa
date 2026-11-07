import { localDateIso } from "@/lib/constants";
import { saveState, parseBackupText } from "@/lib/learning-progress";
import { localKV, progressStoreFor } from "@/lib/progress-store";

/** Backup export/import for one user's progress (same per-user key the app reads). */
export function useBackupRestore(uid: string | null) {
  const handleExportBackup = () => {
    if (!uid) return;
    try {
      const data = progressStoreFor(localKV, uid).read();
      if (!data) {
        console.warn("No backup data found");
        return;
      }
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gita-108-backup-${localDateIso()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Backup export failed", e);
      alert("Failed to export backup. Check console for details.");
    }
  };

  const handleImportBackup = () => {
    if (!uid) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = parseBackupText(reader.result as string);
        if (!result.ok) {
          alert(`Invalid backup file: ${result.error}`);
          return;
        }
        try {
          const store = progressStoreFor(localKV, uid);
          saveState(store, result.state);
          // An import is a user edit: make it newer than the cloud copy so it syncs up.
          store.writeMeta({ updatedAt: Math.max(Date.now(), store.readMeta().updatedAt + 1), synced: store.readMeta().synced });
          window.location.reload();
        } catch (err) {
          console.error("Backup import failed", err);
          alert("Failed to save backup. Check console for details.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return { handleExportBackup, handleImportBackup };
}
