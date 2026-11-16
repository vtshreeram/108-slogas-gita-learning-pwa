import { describe, expect, it, vi } from "vitest";
import { clientErrorResponse } from "@/lib/server/client-errors";
import { GET as health } from "@/app/api/health/route";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://gita.test/api/client-errors", { method: "POST", body, headers: { "Content-Type": "application/json", ...headers } });
const valid = { source: "window-error", name: "TypeError", message: "x is undefined", path: "/" };

describe("/api/client-errors", () => {
  it("logs a valid report as one searchable JSON line", async () => {
    const log = vi.fn();
    const response = await clientErrorResponse(post(JSON.stringify(valid)), log);
    expect(response.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(log.mock.calls[0][0]);
    expect(line).toMatchObject({ type: "client_error", ...valid });
    expect(typeof line.at).toBe("string");
  });

  it("drops malformed, invalid and oversized reports without logging", async () => {
    const log = vi.fn();
    expect((await clientErrorResponse(post("not json"), log)).status).toBe(400);
    expect((await clientErrorResponse(post(JSON.stringify({ ...valid, source: "nope" })), log)).status).toBe(400);
    expect((await clientErrorResponse(post(JSON.stringify({ ...valid, extra: 1 })), log)).status).toBe(400);
    expect((await clientErrorResponse(post(JSON.stringify({ ...valid, stack: "s".repeat(9000) })), log)).status).toBe(413);
    expect((await clientErrorResponse(post("{}", { "Content-Length": "999999" }), log)).status).toBe(413);
    expect(log).not.toHaveBeenCalled();
  });
});

describe("/api/health", () => {
  it("answers ok and is never cached", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).status).toBe("ok");
  });
});
