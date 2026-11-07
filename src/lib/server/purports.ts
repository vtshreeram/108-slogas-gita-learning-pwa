import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Purports are a work in progress: a chapter with no data is an empty object, not an error. */
export async function purportResponse(chapter: string, read: (path: string, encoding: "utf8") => Promise<string> = readFile): Promise<Response> {
  if (!/^(?:[1-9]|1[0-8])$/.test(chapter)) return Response.json({ error: "Choose a chapter from 1 to 18." }, { status: 400 });
  try {
    const text = await read(join(process.cwd(), "src/data/purports", `chapter-${chapter}.json`), "utf8");
    return new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Response.json({}, { headers: { "Cache-Control": "public, max-age=300" } });
    return Response.json({ error: "Purports could not be loaded." }, { status: 500 });
  }
}
