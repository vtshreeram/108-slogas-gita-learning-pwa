import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDLecXV97GpSFjbReKspPD6XdVHWhLW_J4",
  authDomain: "bhagavad-gita-pwa.firebaseapp.com",
  projectId: "bhagavad-gita-pwa",
  storageBucket: "bhagavad-gita-pwa.firebasestorage.app",
  messagingSenderId: "669306804260",
  appId: "1:669306804260:web:1e90997c92b344b20520b1",
  measurementId: "G-LBCGN8Y37Q"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable local persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Firebase persistence error:", error);
});

export const googleProvider = new GoogleAuthProvider();
