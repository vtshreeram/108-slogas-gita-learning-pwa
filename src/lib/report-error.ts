/** Browser glue for `error-report.ts`: one reporter per page load, sent with sendBeacon so it survives a reload. */
import { ERROR_REPORT_ENDPOINT, type ErrorSource, buildReport, createReporter } from "@/lib/error-report";

// Vercel exposes the deployed commit at build time, so a report names the release it came from.
const RELEASE = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12);

const report = createReporter((payload) => {
  const body = JSON.stringify(payload);
  const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ERROR_REPORT_ENDPOINT, new Blob([body], { type: "application/json" }));
  if (!sent) void fetch(ERROR_REPORT_ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
});

export function reportError(error: unknown, source: ErrorSource) {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
  report(buildReport(error, source, { path: window.location.pathname, release: RELEASE, userAgent: navigator.userAgent, online: navigator.onLine }));
}
