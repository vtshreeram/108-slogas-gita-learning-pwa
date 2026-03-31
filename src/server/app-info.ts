import "server-only";

import { env } from "@/lib/env";

export function getAppInfo() {
  return {
    name: env.NEXT_PUBLIC_APP_NAME,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
