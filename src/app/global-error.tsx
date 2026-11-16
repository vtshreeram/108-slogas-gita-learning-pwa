"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

/**
 * Last-resort screen for a crash in the root layout itself (where `error.tsx` cannot help).
 * It replaces the whole document, so it renders its own <html>/<body> and uses inline styles
 * instead of relying on the app stylesheet or providers that may be what failed.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error, "root-boundary"); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#f2e8d0", color: "#4a3615", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <main style={{ maxWidth: 360, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Gita 108 could not start</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 16px", color: "#6b5532" }}>
            Something went wrong while opening the app. Your saved progress is stored on this device and has not been changed.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ border: 0, borderRadius: 12, padding: "10px 24px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#8a6b3d", cursor: "pointer" }}
          >
            Reload app
          </button>
          {error.digest && <p style={{ fontSize: 11, marginTop: 16, color: "#8a6b3d" }}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
