"use client";

import { Suspense, type ReactNode } from "react";
import { AppLoader } from "@/components/app-loader";
import { useLearningSession } from "@/components/learning-provider";
import { LoginScreen } from "@/components/login-screen";

export function AuthenticatedPage({ children }: { children: ReactNode }) {
  const { user, checking, signIn } = useLearningSession();
  if (checking) return <AppLoader />;
  if (!user) return <LoginScreen onSignIn={signIn} />;
  return <Suspense fallback={<AppLoader />}>{children}</Suspense>;
}
