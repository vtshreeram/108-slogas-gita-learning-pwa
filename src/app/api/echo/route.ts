import { z } from "zod";

import { jsonOk } from "@/lib/server/response";
import { parseJsonBody } from "@/lib/server/validation";
import { routeHandler } from "@/lib/server/route";

export const dynamic = "force-dynamic";

const echoQuerySchema = z.object({
  message: z.string().trim().min(1).max(200),
});

const echoBodySchema = z.object({
  message: z.string().trim().min(1).max(200),
});

export const GET = routeHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = echoQuerySchema.parse({
    message: searchParams.get("message"),
  });

  return jsonOk({
    echo: query.message,
    source: "query",
  });
});

export const POST = routeHandler(async (request: Request) => {
  const body = await parseJsonBody(request, echoBodySchema);

  return jsonOk({
    echo: body.message,
    source: "body",
  });
});
