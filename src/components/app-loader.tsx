"use client";
import { useEffect, useState } from "react";

/** Plain loading state: nothing for the first 300 ms (most loads finish by then), then three soft dots. */
export function AppLoader() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setVisible(true), 300); return () => clearTimeout(timer); }, []);
  return <main id="main-content" className="app-loader" aria-busy="true">
    <div role="status" className="app-loader-dots" data-visible={visible || undefined}>
      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  </main>;
}
