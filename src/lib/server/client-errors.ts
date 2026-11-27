import { MAX_REPORT_BYTES, errorReportSchema } from "@/lib/error-report";

type Log = (line: string) => void;

/**
 * Only the app's own pages may file reports. Browsers always state where a POST comes from
 * (Origin, and Sec-Fetch-Site on current ones), so another website cannot use its visitors
 * to flood the logs. A request with neither header is not from a browser page and is accepted
 * as before (uptime checks, tests); it is still size-capped and schema-checked.
 */
function fromAnotherSite(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try { return new URL(origin).host !== host; } catch { return true; }
}

/** Read at most `max` bytes of the body; null when it is larger (the rest is never buffered). */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

/**
 * Validates a crash report and writes it as one JSON log line. Always answers quickly with
 * no body: the sender is a beacon that never reads the reply, and a bad report is only dropped.
 */
export async function clientErrorResponse(request: Request, log: Log = (line) => console.error(line)) {
  if (fromAnotherSite(request)) return new Response(null, { status: 403 });
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return new Response(null, { status: 415 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REPORT_BYTES) return new Response(null, { status: 413 });
  let text: string | null;
  try { text = await readCapped(request, MAX_REPORT_BYTES); } catch { return new Response(null, { status: 400 }); }
  if (text === null) return new Response(null, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  const parsed = errorReportSchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });
  log(JSON.stringify({ type: "client_error", at: new Date().toISOString(), ...parsed.data }));
  return new Response(null, { status: 204 });
}
