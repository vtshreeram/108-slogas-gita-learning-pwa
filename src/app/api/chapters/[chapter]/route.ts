import { chapterResponse } from "@/lib/server/chapters";

// Chapter data is fixed at build time: serve the 18 files as static assets instead of running a function per request.
export const dynamic = "force-static";
export const generateStaticParams = () => Array.from({ length: 18 }, (_, i) => ({ chapter: String(i + 1) }));

export async function GET(_request: Request, context: { params: Promise<{ chapter: string }> }) {
  return chapterResponse((await context.params).chapter);
}
