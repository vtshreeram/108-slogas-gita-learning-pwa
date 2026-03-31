import { z } from "zod";

import { jsonOk } from "@/lib/server/response";
import { parseJsonBody, withValidationError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

const echoQuerySchema = z.object({
  message: z.string().trim().min(1).max(200),
});

const echoBodySchema = z.object({
  message: z.string().trim().min(1).max(200),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = echoQuerySchema.parse({
      message: searchParams.get("message"),
    });

    return jsonOk({
      echo: query.message,
      source: "query",
    });
  } catch (error) {
    return withValidationError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, echoBodySchema);

    return jsonOk({
      echo: body.message,
      source: "body",
    });
  } catch (error) {
    return withValidationError(error);
  }
}
