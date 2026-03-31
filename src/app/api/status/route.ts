import { jsonOk } from "@/lib/server/response";
import { getAppInfo } from "@/server/app-info";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk({
    service: getAppInfo(),
  });
}
