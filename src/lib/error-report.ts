/**
 * Client crash reporting: pure rules (what is sent, what is dropped, how often).
 * Reports go to the app's own `/api/client-errors` route, which writes one log line
 * that shows up in the hosting logs. No third-party service, and no user id,
 * progress, query string or other personal data is ever included.
 */
import { z } from "zod";

export const ERROR_REPORT_ENDPOINT = "/api/client-errors";
/** Per page load. A crash loop must not flood the logs or the learner's data plan. */
export const MAX_REPORTS_PER_PAGE = 5;
export const MAX_REPORT_BYTES = 8 * 1024;

export const ERROR_SOURCES = ["window-error", "unhandled-rejection", "route-boundary", "root-boundary", "audio-boundary"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];

export const errorReportSchema = z.object({
  source: z.enum(ERROR_SOURCES),
  name: z.string().max(100),
  message: z.string().max(500),
  stack: z.string().max(4000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(200),
  release: z.string().max(40).optional(),
  userAgent: z.string().max(300).optional(),
  online: z.boolean().optional(),
}).strict();
export type ErrorReport = z.infer<typeof errorReportSchema>;

// Browser noise that is not an app failure and that nobody can act on.
const IGNORED = [
  /^Script error\.?$/i, // cross-origin script with no details (extensions, injected scripts)
  /ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)/i,
  /^AbortError\b/i, // a cancelled fetch or a paused play() is intentional
  /The play\(\) request was interrupted/i,
];

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

export type ReportContext = { path: string; release?: string; userAgent?: string; online?: boolean };

/** Turn anything thrown into a bounded report, or null when it is noise. */
export function buildReport(error: unknown, source: ErrorSource, context: ReportContext): ErrorReport | null {
  const err = error instanceof Error ? error
    : typeof error === "object" && error !== null && "message" in error ? Object.assign(new Error(String((error as { message: unknown }).message)), error)
      : new Error(typeof error === "string" ? error : safeString(error));
  const name = err.name || "Error";
  const message = err.message || "(no message)";
  if (IGNORED.some((rule) => rule.test(message) || rule.test(`${name}: ${message}`))) return null;
  const digest = (err as Error & { digest?: unknown }).digest;
  return {
    source,
    name: clip(name, 100),
    message: clip(message, 500),
    ...(err.stack ? { stack: clip(err.stack, 4000) } : {}),
    ...(typeof digest === "string" ? { digest: clip(digest, 100) } : {}),
    // Pathname only: query strings and hashes can carry anything.
    path: clip(context.path.split(/[?#]/)[0] || "/", 200),
    ...(context.release ? { release: clip(context.release, 40) } : {}),
    ...(context.userAgent ? { userAgent: clip(context.userAgent, 300) } : {}),
    ...(context.online !== undefined ? { online: context.online } : {}),
  };
}

function safeString(value: unknown) {
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

/** De-duplicates identical errors and caps reports per page load. `send` must never throw. */
export function createReporter(send: (report: ErrorReport) => void, max = MAX_REPORTS_PER_PAGE) {
  const seen = new Set<string>();
  return (report: ErrorReport | null) => {
    if (!report || seen.size >= max) return false;
    const key = `${report.source}|${report.name}|${report.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    try { send(report); } catch { /* reporting must never cause a second failure */ }
    return true;
  };
}
