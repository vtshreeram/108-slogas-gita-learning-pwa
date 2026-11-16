import { clientErrorResponse } from "@/lib/server/client-errors";

// Receives crash reports from the app. Each one becomes a single log line (search the logs for "client_error").
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return clientErrorResponse(request);
}
