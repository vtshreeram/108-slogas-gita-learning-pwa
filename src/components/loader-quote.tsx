"use client";

import { useState, useEffect } from "react";

const KRISHNA_QUOTES = [
  {
    text: "The mind is restless, turbulent, strong, and unyielding... as difficult to subdue as the wind.",
    source: "Bhagavad Gita 6.34"
  },
  {
    text: "You have the right to work, but not to the fruits of work.",
    source: "Bhagavad Gita 2.47"
  },
  {
    text: "The greatest religion is to be true to this dharma; neglect of it has caused the ruin of many.",
    source: "Bhagavad Gita 3.35"
  },
  {
    text: "Set your heart upon your duty and perform it without attachment to the results.",
    source: "Bhagavad Gita 3.30"
  },
  {
    text: "One who is not disturbed by the incessant flow of desires... attains peace.",
    source: "Bhagavad Gita 2.70"
  },
  {
    text: "Yoga is the journey of the self, through the self, to the self.",
    source: "Bhagavad Gita 6.20"
  },
  {
    text: "A person is said to be still situated in yoga when they find joy in their own inner self.",
    source: "Bhagavad Gita 6.18"
  },
  {
    text: "The supreme knowledge is beyond the Vedas and cannot be destroyed.",
    source: "Bhagavad Gita 15.1"
  },
];

export function LoaderQuote() {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    // Select a random quote on mount (same quote throughout loading)
    setQuoteIndex(Math.floor(Math.random() * KRISHNA_QUOTES.length));
  }, []);

  const quote = KRISHNA_QUOTES[quoteIndex];

  return (
    <main className="min-h-screen bg-[#f2e8d0] dark:bg-[#15100a] flex items-center justify-center p-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
      <div className="flex flex-col items-center gap-8 max-w-lg w-full">
        {/* Om symbol with spinning animation */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] opacity-20 animate-pulse" />
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] border-2 border-[#c4a062] dark:border-[#423321] text-5xl text-[#4a3615] animate-spin" style={{ animationDuration: "3s" }}>
            ॐ
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center">
          <p className="text-sm font-semibold text-[#a88d63] dark:text-[#bda27e] tracking-wide mb-2">Awakening Practice...</p>
          <div className="flex justify-center gap-1">
            <div className="h-2 w-2 rounded-full bg-[#c0a986] dark:bg-[#bda27e] animate-bounce" style={{ animationDelay: "0s" }} />
            <div className="h-2 w-2 rounded-full bg-[#c0a986] dark:bg-[#bda27e] animate-bounce" style={{ animationDelay: "0.15s" }} />
            <div className="h-2 w-2 rounded-full bg-[#c0a986] dark:bg-[#bda27e] animate-bounce" style={{ animationDelay: "0.3s" }} />
          </div>
        </div>

        {/* Krishna quote */}
        <div className="bg-white dark:bg-[#1e1710] rounded-2xl border border-[#f0d498] dark:border-[#423321] p-6 shadow-lg">
          <p className="text-center text-sm font-serif text-[#4a3615] dark:text-[#f0e3ce] leading-relaxed mb-3">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-center text-xs font-semibold text-[#a88d63] dark:text-[#bda27e] tracking-wide">
            &mdash; {quote.source}
          </p>
        </div>
      </div>
    </main>
  );
}
