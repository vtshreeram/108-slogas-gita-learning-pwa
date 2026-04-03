"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f2e8d0] dark:bg-[#15100a] px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321]">
          <span className="font-serif text-xl text-[#4a3615] dark:text-[#f0e3ce]">!</span>
        </div>
        <h2 className="text-lg font-semibold text-[#4a3615] dark:text-[#f0e3ce]">Something went wrong</h2>
        <p className="text-xs text-[#8a6b3d] dark:text-[#bda27e]">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-xl bg-gradient-to-r from-[#8a6b3d] to-[#6b512c] px-6 py-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(138,107,61,0.3)]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
