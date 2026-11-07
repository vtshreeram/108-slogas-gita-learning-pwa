"use client";
import { useEffect, useRef, useState } from "react";
import { SHLOKAS } from "@/lib/shlokas";
import { AUDIO_CACHE, audioUrl, downloadAudio, formatBytes, listDownloads } from "@/lib/offline-audio";

type Download = { url: string; bytes: number };
export function OfflineLibrary({ reference }: { reference: string }) {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [quota, setQuota] = useState<number | undefined>();
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const downloaded = downloads.some((item) => item.url === audioUrl(reference));
  async function refresh() {
    const items = await listDownloads();
    if (mounted.current) setDownloads(items);
    const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
    if (mounted.current) setQuota(estimate?.quota === undefined ? undefined : Math.max(0, estimate.quota - (estimate.usage ?? 0)));
    window.dispatchEvent(new Event("gita-downloads-changed"));
  }
  useEffect(() => {
    mounted.current = true;
    const available = window.isSecureContext && "caches" in window;
    setSupported(available);
    if (available) void refresh().catch(() => setMessage("Offline storage is unavailable in this browser session."));
    return () => { mounted.current = false; controller.current?.abort(); };
    // This device library is shared by accounts; it loads once.
  }, []);
  async function download(refs: string[]) {
    if (busy) return;
    const aborter = new AbortController(); controller.current = aborter; setBusy(true);
    let saved = 0;
    try {
      for (const ref of refs) {
        if (aborter.signal.aborted) break;
        if (downloads.some((item) => item.url === audioUrl(ref))) continue;
        setMessage(`Downloading ${ref} (${saved + 1} of ${refs.length})…`);
        await downloadAudio(ref, aborter.signal); saved++;
        await refresh();
      }
      if (mounted.current) setMessage(aborter.signal.aborted ? `Cancelled. ${saved} new download(s) kept.` : `${saved} new verse(s) saved for offline playback.`);
    } catch (e) {
      if (mounted.current) setMessage(aborter.signal.aborted ? `Cancelled. ${saved} new download(s) kept.` : e instanceof Error ? e.message : "Download failed. Check your connection and available storage.");
    } finally { if (mounted.current) { setBusy(false); setSelected([]); } }
  }
  async function remove(url?: string) {
    try {
      const cache = await caches.open(AUDIO_CACHE);
      if (url) await cache.delete(url); else await Promise.all((await cache.keys()).map((key) => cache.delete(key)));
      await refresh(); setMessage(url ? "Download removed." : "Audio downloads removed. Your learning progress is unchanged.");
    } catch { setMessage("Could not remove the download. Please try again."); }
  }
  return <section className="study-panel" aria-label="Offline audio">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold text-sm">Offline audio</h2><p className="study-muted text-xs">{downloads.length} saved · {formatBytes(downloads.reduce((sum, item) => sum + item.bytes, 0))}</p></div>
      <button className="study-button" disabled={!supported || busy} onClick={() => downloaded ? void remove(audioUrl(reference)) : void download([reference])}>{downloaded ? `Remove ${reference}` : `Download ${reference}`}</button>
    </div>
    {!supported && <p className="mt-2 text-sm">Offline downloads need a browser with device storage support.</p>}
    <p className="mt-2 text-xs" role="status" aria-live="polite">{message}</p>
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm underline underline-offset-4">Manage downloads</summary>
      <p className="study-muted text-xs">Saved on this device. Browsers may clear downloads when storage is low.{quota !== undefined && ` About ${formatBytes(quota)} available for this site.`}</p>
      <div className="my-3 flex flex-wrap gap-2">
        <button className="study-button" disabled={busy || !supported} onClick={() => setSelected(SHLOKAS.filter((s) => !downloads.some((d) => d.url === audioUrl(s.reference))).map((s) => s.reference))}>Select missing</button>
        <button className="study-button" disabled={busy} onClick={() => setSelected([])}>Clear selection</button>
      </div>
      <div className="rounded-lg border border-[var(--study-border)] p-2">
        {SHLOKAS.map((s) => <label key={s.id} className="flex min-h-11 items-center gap-3 px-2 text-sm">
          <input type="checkbox" disabled={busy || !supported} checked={selected.includes(s.reference)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, s.reference] : prev.filter((r) => r !== s.reference))} />
          <span className="flex-1">Verse {s.reference}</span><span className="study-muted text-xs">{downloads.some((d) => d.url === audioUrl(s.reference)) ? "Downloaded" : "Online"}</span>
        </label>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="study-button study-primary" disabled={busy || !supported || !selected.length} onClick={() => void download(selected)}>Download selected ({selected.length})</button>
        {busy && <button className="study-button" onClick={() => controller.current?.abort()}>Cancel download</button>}
        <button className="study-button" disabled={busy || !downloads.length} onClick={() => void remove()}>Remove all downloads</button>
      </div>
    </details>
  </section>;
}
