import { describe, expect, it, vi } from "vitest";
import { MAX_REPORTS_PER_PAGE, buildReport, createReporter, errorReportSchema } from "@/lib/error-report";

const ctx = { path: "/chapters?uid=secret#x", release: "abc123", userAgent: "UA", online: true };

describe("client error reports", () => {
  it("builds a valid, bounded report from an Error", () => {
    const err = Object.assign(new Error("x".repeat(2000)), { digest: "d1" });
    const report = buildReport(err, "route-boundary", ctx)!;
    expect(errorReportSchema.safeParse(report).success).toBe(true);
    expect(report.message.length).toBe(500);
    expect(report.digest).toBe("d1");
    expect(report.source).toBe("route-boundary");
  });

  it("keeps the pathname only, so query strings and hashes never leave the device", () => {
    expect(buildReport(new Error("boom"), "window-error", ctx)!.path).toBe("/chapters");
    expect(buildReport(new Error("boom"), "window-error", { path: "?a=1" })!.path).toBe("/");
  });

  it("accepts strings, error-like objects and other thrown values", () => {
    expect(buildReport("plain", "unhandled-rejection", ctx)!.message).toBe("plain");
    expect(buildReport({ message: "like" }, "unhandled-rejection", ctx)!.message).toBe("like");
    expect(buildReport({ code: 7 }, "unhandled-rejection", ctx)!.message).toBe('{"code":7}');
    expect(buildReport(undefined, "unhandled-rejection", ctx)!.message).toBe("undefined");
  });

  it("drops browser noise nobody can act on", () => {
    for (const noise of ["Script error.", "ResizeObserver loop limit exceeded", "The play() request was interrupted by a call to pause()"]) {
      expect(buildReport(new Error(noise), "window-error", ctx)).toBeNull();
    }
    expect(buildReport(new DOMException("The user aborted a request.", "AbortError"), "unhandled-rejection", ctx)).toBeNull();
  });

  it("sends each distinct error once and caps reports per page load", () => {
    const send = vi.fn();
    const report = createReporter(send);
    const same = buildReport(new Error("same"), "window-error", ctx);
    expect(report(same)).toBe(true);
    expect(report(same)).toBe(false);
    expect(report(null)).toBe(false);
    for (let i = 0; i < 20; i++) report(buildReport(new Error(`e${i}`), "window-error", ctx));
    expect(send).toHaveBeenCalledTimes(MAX_REPORTS_PER_PAGE);
  });

  it("never throws when sending fails", () => {
    const report = createReporter(() => { throw new Error("offline"); });
    expect(() => report(buildReport(new Error("a"), "window-error", ctx))).not.toThrow();
  });

  it("rejects unknown fields and sources", () => {
    const valid = buildReport(new Error("a"), "window-error", ctx)!;
    expect(errorReportSchema.safeParse({ ...valid, uid: "user-1" }).success).toBe(false);
    expect(errorReportSchema.safeParse({ ...valid, source: "other" }).success).toBe(false);
  });
});
