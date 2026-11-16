import { MAX_REPORT_BYTES, errorReportSchema } from "@/lib/error-report";

type Log = (line: string) => void;

/**
 * Validates a crash report and writes it as one JSON log line. Always answers quickly with
 * no body: the sender is a beacon that never reads the reply, and a bad report is only dropped.
 */
export async function clientErrorResponse(request: Request, log: Log = (line) => console.error(line)) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REPORT_BYTES) return new Response(null, { status: 413 });
  let text: string;
  try { text = await request.text(); } catch { return new Response(null, { status: 400 }); }
  if (text.length > MAX_REPORT_BYTES) return new Response(null, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  const parsed = errorReportSchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });
  log(JSON.stringify({ type: "client_error", at: new Date().toISOString(), ...parsed.data }));
  return new Response(null, { status: 204 });
}
