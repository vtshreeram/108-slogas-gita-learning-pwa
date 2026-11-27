import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";

// Firebase web configuration. These values identify the project; they are not secrets (every visitor's browser
// receives them), and access is controlled by Firebase Auth, the Firestore rules and the key's referrer restriction.
// Each one can be supplied at build time (for example synced from Infisical into Vercel); the project's current
// values are the fallback, so a missing variable never breaks sign-in. Redeploy after changing a variable.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDLecXV97GpSFjbReKspPD6XdVHWhLW_J4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bhagavad-gita-pwa.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bhagavad-gita-pwa",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bhagavad-gita-pwa.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "669306804260",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:669306804260:web:1e90997c92b344b20520b1",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-LBCGN8Y37Q",
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

    // A blocked popup can use redirect; closing a popup is an intentional cancellation.
    if (errorCode === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    // Re-throw other auth errors
    console.error("Google sign-in failed:", error);
    throw error;
  }
}
