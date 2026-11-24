import { GITA_CHAPTERS, type GitaVerse } from "@/lib/gita-verses";
import { chapterResponse } from "@/lib/server/chapters";
import { verseSearchEntry } from "@/lib/verse-search";

// The same fixed dataset as the per-chapter routes, prepared once at build time.
export const dynamic = "force-static";

export async function GET() {
  const chapters = await Promise.all(GITA_CHAPTERS.map(async (chapter) => {
    const response = await chapterResponse(String(chapter));
    return response.ok ? await response.json() as GitaVerse[] : null;
  }));
  if (chapters.some((chapter) => chapter === null)) {
    return Response.json({ error: "The complete verse index is unavailable." }, { status: 503 });
  }

  return Response.json(chapters.flatMap((chapter) => (chapter ?? []).map(verseSearchEntry)), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
