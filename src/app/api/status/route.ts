import { jsonOk } from "@/lib/server/response";
import { getAppInfo } from "@/server/app-info";
import { routeHandler } from "@/lib/server/route";

export const dynamic = "force-dynamic";

export const GET = routeHandler(async () => {
  return jsonOk({
    service: getAppInfo(),
  });
});
