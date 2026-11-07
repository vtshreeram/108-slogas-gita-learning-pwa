import { describe, expect, it } from "vitest";
import { requiresPageReload } from "../runtime-recovery";

describe("stale runtime recovery", () => {
  it("reloads the reported missing-factory error and missing asset errors", () => {
    expect(requiresPageReload(new Error("Module [project]/src/lib/learning-progress.ts was instantiated but the module factory is not available. It might have been deleted in an HMR update."))).toBe(true);
    expect(requiresPageReload(Object.assign(new Error("Loading chunk 123 failed."), { name: "ChunkLoadError" }))).toBe(true);
    expect(requiresPageReload(new Error("Failed to fetch dynamically imported module: /_next/static/chunks/page.js"))).toBe(true);
  });

  it("keeps ordinary application errors retryable without a forced reload", () => {
    expect(requiresPageReload(new Error("Could not save progress"))).toBe(false);
  });
});
