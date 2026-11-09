"use client";

import { useLearning } from "@/components/learning-provider";
import { LoginScreen } from "@/components/login-screen";
import { LoaderQuote } from "@/components/loader-quote";
import { ChapterAudios } from "@/components/chapter-audios";

export default function ChaptersPage() {
  const { session } = useLearning();
  const { user, checking, signIn } = session;
  if (checking) return <LoaderQuote />;
  if (!user) return <LoginScreen onSignIn={signIn} />;
  return <ChapterAudios uid={user.uid} />;
}
