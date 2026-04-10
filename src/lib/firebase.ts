import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDHPE8eR5MqHqW2JNVEXWtcmG3bUYiy_WA",
  authDomain: "bglite-6bcdd.firebaseapp.com",
  projectId: "bglite-6bcdd",
  storageBucket: "bglite-6bcdd.firebasestorage.app",
  messagingSenderId: "669843995088",
  appId: "1:669843995088:web:87fe3a687877998c9021d5",
  measurementId: "G-X5YFNYNW7Q",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable local persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Firebase persistence error:", error);
});

export const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google using popup-first strategy with redirect fallback.
 *
 * Some browsers (particularly on iOS) block popups in certain contexts.
 * This function attempts popup authentication first, then falls back to
 * redirect flow if the popup is blocked or closed by the user.
 *
 * @throws Error if both popup and redirect fail
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    // Try popup authentication first (better UX)
    await signInWithPopup(auth, googleProvider);
  } catch (error: unknown) {
    const errorCode = (error as { code?: string }).code;

    // If popup was blocked or closed, try redirect flow
    if (errorCode === "auth/popup-blocked" || errorCode === "auth/popup-closed-by-user") {
      signInWithRedirect(auth, googleProvider);
      return;
    }

    // Re-throw other auth errors
    console.error("Google sign-in failed:", error);
    throw error;
  }
}
