"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { useShlokaState } from "@/hooks/use-shloka-state";

type LearningContextValue = {
  session: ReturnType<typeof useSession>;
  learner: ReturnType<typeof useShlokaState>;
  profile: ReturnType<typeof useProfile>;
};

const LearningContext = createContext<LearningContextValue | null>(null);

/** Keep the account and its local progress alive when moving between study and profile. */
export function LearningProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const learner = useShlokaState(session.user?.uid ?? null);
  const profile = useProfile(session.user);
  return <LearningContext.Provider value={{ session, learner, profile }}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const value = useContext(LearningContext);
  if (!value) throw new Error("LearningProvider is required");
  return value;
}
