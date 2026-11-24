"use client";

import { lazy } from "react";
import { AuthenticatedPage } from "@/components/authenticated-page";

const loadChapters = () => import("@/components/chapter-audios").then((m) => ({ default: m.ChapterAudios }));
const ChapterAudios = lazy(loadChapters);

export default function ChaptersPage() {
  return <AuthenticatedPage><ChapterAudios /></AuthenticatedPage>;
}
