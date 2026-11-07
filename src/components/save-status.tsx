type Props = { status: "local" | "pending" | "syncing" | "synced" | "error"; storageError: boolean; online: boolean; onRetry: () => void };
export function SaveStatus({ status, storageError, online, onRetry }: Props) {
  const label = storageError ? "Progress could not be saved on this device" : !online ? "Offline · saved on this device" : status === "synced" ? "Progress synced" : status === "syncing" ? "Saved on this device · syncing…" : status === "pending" ? "Saved on this device · sync pending" : status === "error" ? "Saved on this device · sync needs retry" : "Saved on this device";
  return <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs" role="status" aria-live="polite"><span>{label}</span>{(storageError || status === "error") && <button className="study-button" onClick={onRetry}>Retry saving</button>}</div>;
}
