// Liveness check for uptime monitors: answers only when the deployment can run server code.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
