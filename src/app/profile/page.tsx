"use client";

import { lazy } from "react";
import { AuthenticatedPage } from "@/components/authenticated-page";

const loadProfile = () => import("@/components/profile-content");
const ProfileContent = lazy(loadProfile);

export default function ProfilePage() {
  return <AuthenticatedPage><ProfileContent /></AuthenticatedPage>;
}
