import { z } from "zod";
import { STORAGE_KEY } from "@/lib/constants";
import { appStateBackupSchema } from "@/lib/schemas";

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
          // Validate backup structure against Zod schema
          const validated = appStateBackupSchema.parse(parsed);
          // Write validated data to storage and reload
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
          window.location.reload();
        } catch (err) {
          if (err instanceof z.ZodError) {
            const issues = err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
            alert(`Invalid backup file: ${issues}`);
          } else {
            console.error("Backup import failed", err);
            alert("Invalid backup file. Check console for details.");
          }
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return { handleExportBackup, handleImportBackup };
}
