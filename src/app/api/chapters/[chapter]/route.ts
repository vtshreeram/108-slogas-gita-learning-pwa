import { chapterResponse } from "@/lib/server/chapters";

export async function GET(_request: Request, context: { params: Promise<{ chapter: string }> }) {
  return chapterResponse((await context.params).chapter);
}
