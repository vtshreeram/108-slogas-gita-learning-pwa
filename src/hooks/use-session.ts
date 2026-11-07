import { useEffect, useState } from "react";
import { User, getRedirectResult, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, signInWithGoogle } from "@/lib/firebase";

/** Auth session: current user, loading flag, sign-in and sign-out. */
export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Handle redirect result after Google sign-in redirect returns
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect sign-in error:", error);
    });
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = () => signInWithGoogle();
  const logOut = () => signOut(auth);

  return { user, checking, signIn, signOut: logOut };
}
