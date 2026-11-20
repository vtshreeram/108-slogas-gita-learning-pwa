"use client";

import { useLearning } from "@/components/learning-provider";
import { LoginScreen } from "@/components/login-screen";
import { AppLoader } from "@/components/app-loader";
import { ChapterAudios } from "@/components/chapter-audios";

export default function ChaptersPage() {
  const { session } = useLearning();
  const { user, checking, signIn } = session;
  if (checking) return <AppLoader />;
  if (!user) return <LoginScreen onSignIn={signIn} />;
  return <ChapterAudios />;
}
