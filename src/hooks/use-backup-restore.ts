import { localStorageAdapter, parseBackupText, saveState } from "@/lib/learning-progress";

export function useBackupRestore() {
  const handleExportBackup = () => {
    try {
      const data = localStorageAdapter.read();
      if (!data) {
        console.warn("No backup data found");
        return;
      }
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gita-108-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
          saveState(localStorageAdapter, result.state);
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
