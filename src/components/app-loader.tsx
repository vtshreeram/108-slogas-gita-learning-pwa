"use client";
import { useEffect, useState } from "react";

const SLOW_MS = 8000;

/** Loading state: the ॐ mark with a slow breathing glow, shown from the first paint (it is in the server HTML). After 8 s a hint appears so it never looks stuck. */
export function AppLoader() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), SLOW_MS); return () => clearTimeout(timer); }, []);
  return <main id="main-content" className="app-loader" aria-busy="true">
    <div role="status" className="app-loader-mark">
      <span className="app-loader-om" aria-hidden="true">ॐ</span>
      <span className={slow ? "app-loader-hint" : "sr-only"}>{slow ? "Still loading… check your connection." : "Loading"}</span>
    </div>
  </main>;
}
