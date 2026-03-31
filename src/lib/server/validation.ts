import { ZodError, type ZodType } from "zod";

import { fromZodError, jsonError } from "@/lib/server/response";

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>) {
  const body = await request.json();
  return schema.parse(body);
}

export function withValidationError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(fromZodError(error), { status: 400 });
  }

  return jsonError(
    {
      code: "internal_error",
      message: "Unexpected server error.",
    },
    { status: 500 },
  );
}
