import { withValidationError } from "./validation";

type RouteHandler = (
  request: Request,
  context: unknown
) => Promise<Response> | Response;

export function routeHandler(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: unknown) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return withValidationError(error);
    }
  };
}
