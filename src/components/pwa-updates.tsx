"use client";
import { useEffect, useRef, useState } from "react";

export function PwaUpdates() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const prompted = useRef(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let mounted = true;
    let registration: ServiceWorkerRegistration | undefined;
    const reload = () => { if (prompted.current) window.location.reload(); };
    const check = () => {
      if (!mounted) return;
      // A first install activates on its own; only an existing controlled app has an update.
      setWaiting(registration?.waiting && navigator.serviceWorker.controller ? registration.waiting : null);
    };
    const onFound = () => { registration?.installing?.addEventListener("statechange", check); };
    const onFocus = () => { void registration?.update().catch(() => {}); };
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    if (process.env.NODE_ENV !== "production") {
      // Old workers survive a dev-server restart; unregister only this app's worker.
      void navigator.serviceWorker.getRegistrations().then(async (items) => {
        let removed = false;
        for (const item of items) {
          const worker = item.active ?? item.waiting ?? item.installing;
          if (worker && new URL(worker.scriptURL).pathname === "/sw.js") removed = (await item.unregister()) || removed;
        }
        if (removed) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("gita-shell-")).map((key) => caches.delete(key)));
          // Drop an existing controller once; otherwise it can still serve stale dev chunks.
          if (navigator.serviceWorker.controller) window.location.reload();
        }
      }).catch(() => {});
    } else {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((r) => {
        if (!mounted) return;
        registration = r; check(); r.addEventListener("updatefound", onFound);
        window.addEventListener("focus", onFocus);
      }).catch((e) => console.warn("Offline setup failed:", e));
    }
    return () => { mounted = false; navigator.serviceWorker.removeEventListener("controllerchange", reload); registration?.removeEventListener("updatefound", onFound); window.removeEventListener("focus", onFocus); };
  }, []);
  if (!waiting) return null;
  return <aside className="study-panel mx-3 mt-3 max-w-lg sm:mx-auto" role="status">
    <p className="font-semibold">An update is ready</p><p className="text-sm">Reload when you finish this verse. Your saved progress stays here.</p>
    <div className="mt-2 flex gap-2"><button className="study-button study-primary" disabled={updating} onClick={() => { prompted.current = true; setUpdating(true); waiting.postMessage({ type: "SKIP_WAITING" }); }}>{updating ? "Updating…" : "Update now"}</button><button className="study-button" onClick={() => setWaiting(null)}>Later</button></div>
  </aside>;
}
