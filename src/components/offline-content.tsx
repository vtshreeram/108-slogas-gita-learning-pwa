"use client";
import { useMemo, useSyncExternalStore } from "react";
import { Check, CloudDownload, HardDrive, Pause, Play, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { allPacks, dequeue, getServerSnapshot, getSnapshot, pause, remove, resume, start, subscribe, type Snapshot } from "@/lib/offline-downloads";
import { formatMB, packStatus, type Pack, type PackStatus } from "@/lib/offline-packs";

/** The Offline library: choose what to keep on this device so the app works without internet. */
export default function OfflineContent() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const packs = useMemo(() => allPacks(), []);
  const statuses = useMemo(() => new Map(packs.map((p) => [p.id, packStatus(p, state.saved)])), [packs, state.saved]);
  const [main, chapters] = [packs.filter((p) => !p.id.startsWith("chapter-")), packs.filter((p) => p.id.startsWith("chapter-"))];
  const usage = state.estimate?.usage ?? 0, quota = state.estimate?.quota;
  const missingChapters = chapters.filter((p) => !statuses.get(p.id)!.complete);

  return <main id="main-content" className="inner-page offline-page">
    <PageHeader title="Offline library" backHref="/profile" backLabel="Back to profile" />
    <div className="reading-shell">
      <p className="study-muted mb-4 text-sm">Save what you need on this device, and the app works without internet. Downloads continue while the app is open, even on other screens.</p>

      {!state.supported && state.ready ? <p className="study-panel text-sm" role="alert">This browser cannot store files for offline use. Try Chrome or Safari, or add the app to your home screen.</p> : <>
        <section className="offline-storage" aria-label="Storage on this device">
          <div className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="h-4 w-4" aria-hidden="true" />Storage used by the app</div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMB(usage)}{quota ? <span className="study-muted text-sm font-normal"> of about {formatMB(quota)} allowed</span> : null}</p>
          {quota ? <progress className="learning-progress mt-2 w-full" value={usage} max={quota} aria-label="Storage used" /> : null}
          <p className="mt-2 flex items-start gap-2 text-xs study-muted">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            {state.persisted ? "Protected: the browser will not clear your downloads to free space." : "The browser may clear downloads when the device is low on space. Starting a download asks it to keep them. On iPhone, add the app to the Home Screen so Safari keeps them."}
          </p>
        </section>

        <JobBanner state={state} />

        <ul className="offline-packs">
          {main.map((pack) => <li key={pack.id}><PackCard pack={pack} status={statuses.get(pack.id)!} state={state} /></li>)}
        </ul>

        <section className="mt-6" aria-labelledby="chapter-recordings-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="chapter-recordings-heading" className="section-title">Chapter recordings</h2>
              <p className="study-muted text-sm">Tamil narration, one chapter at a time.</p>
            </div>
            {missingChapters.length > 0 && <button className="study-button" disabled={!state.ready} onClick={() => missingChapters.forEach((p) => start(p.id))}>
              <CloudDownload className="h-4 w-4" aria-hidden="true" />Download all ({formatMB(missingChapters.reduce((sum, p) => sum + statuses.get(p.id)!.totalBytes - statuses.get(p.id)!.savedBytes, 0))})
            </button>}
          </div>
          <ul className="offline-chapters mt-3">
            {chapters.map((pack) => <li key={pack.id}><PackCard pack={pack} status={statuses.get(pack.id)!} state={state} compact /></li>)}
          </ul>
        </section>
      </>}
    </div>
  </main>;
}

function JobBanner({ state }: { state: Snapshot }) {
  const job = state.job;
  if (!job || job.quiet && job.status !== "error") return null;
  const pct = job.bytesTotal ? Math.min(100, Math.round((job.bytesDone / job.bytesTotal) * 100)) : 0;
  return <section className="offline-job" aria-live="polite">
    <p className="text-sm font-semibold">{job.status === "running" ? `Downloading ${job.title}…` : job.title}</p>
    {job.status === "running" || job.status === "paused" ? <>
      <progress className="learning-progress mt-2 w-full" value={pct} max={100} aria-label={`${job.title} download progress`} />
      <p className="study-muted mt-1 text-xs tabular-nums">{job.background && job.status === "running" ? `${job.total} files` : `${job.done} of ${job.total} files`} · {formatMB(job.bytesDone)} of {formatMB(job.bytesTotal)}{state.queue.length ? ` · ${state.queue.length} more waiting` : ""}</p>
    </> : null}
    {job.message && <p className="mt-1 text-sm" role={job.status === "error" ? "alert" : undefined}>{job.message}</p>}
    <div className="mt-2 flex gap-2">
      {job.status === "running" && <button className="study-button" onClick={pause}><Pause className="h-4 w-4" aria-hidden="true" />Pause</button>}
      {(job.status === "paused" || job.status === "error") && <button className="study-button study-primary" onClick={resume}><Play className="h-4 w-4" aria-hidden="true" />Resume</button>}
    </div>
  </section>;
}

function PackCard({ pack, status, state, compact = false }: { pack: Pack; status: PackStatus; state: Snapshot; compact?: boolean }) {
  const running = state.job?.status === "running" && (state.job.pack === pack.id || Boolean(state.job.packs?.includes(pack.id)));
  const queued = state.queue.includes(pack.id);
  const partial = status.savedCount > 0 && !status.complete;
  const left = Math.max(0, status.totalBytes - status.savedBytes);
  const size = pack.id === "essentials" ? "about 5 MB" : formatMB(status.totalBytes);
  const label = status.complete ? "Saved" : status.outdated.length && !status.missing.length ? `Update available · ${status.outdated.length} file${status.outdated.length === 1 ? "" : "s"}` : partial ? `${status.savedCount} of ${pack.items.length} saved` : "Not saved";
  return <article className="offline-pack" data-compact={compact || undefined} data-complete={status.complete || undefined}>
    <div className="min-w-0 flex-1">
      <h3 className="offline-pack-title">{pack.title}</h3>
      {!compact && <p className="study-muted text-sm">{pack.detail}</p>}
      <p className="offline-pack-meta tabular-nums">{status.complete && <Check className="h-4 w-4" aria-hidden="true" />}{label} · {compact ? `${pack.detail} · ` : ""}{size}</p>
    </div>
    <div className="offline-pack-actions">
      {running ? <button className="study-button" onClick={pause}><Pause className="h-4 w-4" aria-hidden="true" />Pause</button>
        : queued ? <button className="study-button" onClick={() => dequeue(pack.id)}>Waiting · Cancel</button>
          : !status.complete ? <button className="study-button study-primary" disabled={!state.ready} onClick={() => start(pack.id)} aria-label={`${status.savedCount ? "Resume" : "Download"} ${pack.title}`}>
            <CloudDownload className="h-4 w-4" aria-hidden="true" />{status.outdated.length && !status.missing.length ? "Update" : status.savedCount ? "Resume" : "Download"}{left && pack.id !== "essentials" ? ` · ${formatMB(left)}` : ""}
          </button> : null}
      {status.savedCount > 0 && !running && <button className="icon-button" aria-label={`Remove ${pack.title}`} onClick={() => { if (window.confirm(`Remove ${pack.title} from this device? You can download it again later.`)) void remove(pack.id); }}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
    </div>
  </article>;
}
