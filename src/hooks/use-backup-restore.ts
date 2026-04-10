import { STORAGE_KEY, SCHEMA_VERSION } from "@/lib/constants";

export function useBackupRestore() {
  const handleExportBackup = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
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
        try {
          const parsed = JSON.parse(reader.result as string);
          // Validate schema version
          if (Number(parsed.schemaVersion) !== SCHEMA_VERSION) {
            alert(`Incompatible backup version. Expected v${SCHEMA_VERSION}, got v${parsed.schemaVersion}`);
            return;
          }
          // Validate required fields
          if (!parsed.completed || typeof parsed.completed !== "object") {
            alert("Invalid backup file: missing or invalid 'completed' field");
            return;
          }
          // Write to storage and reload
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          window.location.reload();
        } catch (err) {
          console.error("Backup import failed", err);
          alert("Invalid backup file. Check console for details.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return { handleExportBackup, handleImportBackup };
}
