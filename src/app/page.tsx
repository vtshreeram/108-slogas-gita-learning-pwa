"use client";

import { AuthenticatedPage } from "@/components/authenticated-page";
import Reader from "@/components/reader";

export default function Home() {
  return <AuthenticatedPage><Reader /></AuthenticatedPage>;
}
