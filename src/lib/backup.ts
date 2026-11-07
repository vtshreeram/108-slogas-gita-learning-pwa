import { z } from "zod";
import type { AppState } from "./constants";
import { parseState } from "./learning-progress";
import { profileSchema } from "./schemas";

export type BackupProfile = z.infer<typeof profileSchema>;
export type LearningBackup = { kind: "gita108"; version: 1; exportedAt: string; progress: AppState; profile?: BackupProfile };

export function createBackup(progress: AppState, profile?: BackupProfile): LearningBackup {
  return { kind: "gita108", version: 1, exportedAt: new Date().toISOString(), progress, profile };
}

/** Both the original progress-only format and the full backup are accepted. */
export function readBackup(text: string): LearningBackup {
  if (text.length > 2_000_000) throw new Error("This backup is too large (maximum 2 MB).");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  const envelope = z.object({ kind: z.literal("gita108"), version: z.literal(1), exportedAt: z.string(), progress: z.unknown(), profile: profileSchema.optional() }).safeParse(raw);
  if (raw && typeof raw === "object" && "kind" in raw && !envelope.success) throw new Error("This backup format or profile is invalid.");
  const parsed = parseState(envelope.success ? envelope.data.progress : raw);
  if (!parsed.ok) throw new Error(`Invalid progress: ${parsed.error}`);
  return { kind: "gita108", version: 1, exportedAt: envelope.success ? envelope.data.exportedAt : "", progress: parsed.state, profile: envelope.success ? envelope.data.profile : undefined };
}

export function mergeProfiles(local: BackupProfile, incoming?: BackupProfile): BackupProfile {
  if (!incoming) return local;
  return { customName: local.customName || incoming.customName, favorites: [...new Set([...local.favorites, ...incoming.favorites])], lineCues: { ...incoming.lineCues, ...local.lineCues } };
}
