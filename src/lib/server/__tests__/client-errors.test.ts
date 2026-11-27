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

describe("/api/client-errors abuse limits", () => {
  it("accepts the app's own pages and refuses other websites", async () => {
    const log = vi.fn();
    const body = JSON.stringify(valid);
    expect((await clientErrorResponse(post(body, { Origin: "https://gita.test", "Sec-Fetch-Site": "same-origin" }), log)).status).toBe(204);
    expect((await clientErrorResponse(post(body, { Origin: "https://evil.test" }), log)).status).toBe(403);
    expect((await clientErrorResponse(post(body, { "Sec-Fetch-Site": "cross-site" }), log)).status).toBe(403);
    expect((await clientErrorResponse(post(body, { Origin: "https://gita.test", "Sec-Fetch-Site": "same-site" }), log)).status).toBe(403);
    expect((await clientErrorResponse(post(body, { Origin: "null" }), log)).status).toBe(403);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("compares the origin with the public host behind a proxy", async () => {
    const log = vi.fn();
    const request = new Request("http://internal:3000/api/client-errors", { method: "POST", body: JSON.stringify(valid), headers: { "Content-Type": "application/json", Origin: "https://gita.example", "X-Forwarded-Host": "gita.example" } });
    expect((await clientErrorResponse(request, log)).status).toBe(204);
  });

  it("refuses bodies that are not JSON by type, and counts bytes rather than characters", async () => {
    const log = vi.fn();
    expect((await clientErrorResponse(post(JSON.stringify(valid), { "Content-Type": "text/plain" }), log)).status).toBe(415);
    // 3000 three-byte characters: under the 8 KB limit as characters, over it as bytes.
    expect((await clientErrorResponse(post(JSON.stringify({ ...valid, stack: "அ".repeat(3000) })), log)).status).toBe(413);
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
