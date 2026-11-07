import { beforeEach, describe, expect, it, vi } from "vitest";
import { chapterResponse } from "@/lib/server/chapters";
const readFile = vi.fn();
const get = (chapter: string) => chapterResponse(chapter, readFile);
beforeEach(() => { readFile.mockReset(); });
describe("chapter availability does not break the learning app", () => {
  it("rejects chapter numbers outside the Gita and traversal inputs", async () => {
    for (const chapter of ["0", "19", "../secret", "01"]) expect((await get(chapter)).status).toBe(400);
    expect(readFile).not.toHaveBeenCalled();
  });
  it("returns a retryable unavailable response while data is still preparing", async () => {
    readFile.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    const response = await get("1");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect((await response.json()).error).toContain("selected 108 verses");
  });
  it("serves the completed chapter and hides internal file errors", async () => {
    readFile.mockResolvedValue('[{"reference":"1.1"}]');
    const response = await get("1"); expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ reference: "1.1" }]);
    readFile.mockRejectedValue(new Error("private path"));
    const error = await get("1"); expect(error.status).toBe(500);
    expect(JSON.stringify(await error.json())).not.toContain("private path");
  });
});
