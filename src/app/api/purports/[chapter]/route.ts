import { purportResponse } from "@/lib/server/purports";

export async function GET(_request: Request, context: { params: Promise<{ chapter: string }> }) {
  return purportResponse((await context.params).chapter);
}
