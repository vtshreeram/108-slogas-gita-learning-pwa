"use client";

import { lazy } from "react";
import { AuthenticatedPage } from "@/components/authenticated-page";

const OfflineContent = lazy(() => import("@/components/offline-content"));

export default function OfflinePage() {
  return <AuthenticatedPage><OfflineContent /></AuthenticatedPage>;
}
