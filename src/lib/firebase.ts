import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "firebase/auth";

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
