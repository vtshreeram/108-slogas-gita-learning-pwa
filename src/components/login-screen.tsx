"use client";

import { useState } from "react";
import { SHLOKAS } from "@/lib/shlokas";

export function LoginScreen({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const sample = SHLOKAS.find((verse) => verse.reference === "2.47")!;

  async function login() {
    setSigningIn(true); setError("");
    try { await onSignIn(); }
    catch { setError("Sign-in did not finish. Check your connection and try again."); }
    finally { setSigningIn(false); }
  }

  return <main id="main-content" className="welcome-page">
    <div className="welcome-content">
      <span className="brand-symbol" aria-hidden="true">ॐ</span>
      <p className="eyebrow mt-6">A little practice, every day</p>
      <h1 className="mt-3 font-serif text-4xl">Bhagavad Gita</h1>
      <p className="study-muted mt-4 text-base leading-relaxed">Read, understand, and remember 108 selected shlokas. Begin with two a day, or choose a gentler pace in your profile.</p>
      <ol className="welcome-steps" aria-label="The learning routine">
        {["Listen", "Repeat", "Understand", "Recall"].map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}
      </ol>
      <button className="study-button study-primary w-full" disabled={signingIn} onClick={() => void login()}>{signingIn ? "Signing in…" : "Sign in with Google"}</button>
      <p className="study-muted mt-3 text-sm">Your learning progress is saved to your account on this device.</p>
      {error && <p className="mt-3 text-sm" role="alert">{error}</p>}
      <details className="sample-verse mt-8">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">Read a sample · Verse 2.47</summary>
        <p className="my-4 whitespace-pre-line text-lg leading-loose" lang="sa-Latn">{sample.transliteration}</p>
        <p className="study-muted text-base leading-relaxed">{sample.english}</p>
        <p className="study-muted mt-4 text-sm">Listen to a recording, repeat the verse, read its meaning, then try reciting without looking. You choose when to mark it learned.</p>
      </details>
    </div>
  </main>;
}
