import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** A data import in progress must not prevent the core learning app from compiling. */
export async function chapterResponse(chapter: string, read: (path: string, encoding: "utf8") => Promise<string> = readFile): Promise<Response> {
  if (!/^(?:[1-9]|1[0-8])$/.test(chapter)) return Response.json({ error: "Choose a chapter from 1 to 18." }, { status: 400 });
  try {
    const text = await read(join(process.cwd(), "src/data/gita", `chapter-${chapter}.json`), "utf8");
    return new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Response.json({ error: "This chapter is not available yet. You can keep practising the selected 108 verses." }, { status: 503, headers: { "Retry-After": "60" } });
    return Response.json({ error: "This chapter could not be loaded. Please try again." }, { status: 500 });
  }
}
