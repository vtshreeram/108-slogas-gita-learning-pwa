"use client";

import React, { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error boundary for the AudioPlayer component.
 * Catches and gracefully handles audio-related errors without crashing the app.
 */
export class AudioErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("AudioErrorBoundary caught an error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[#ebd6ab] dark:border-[#423321] bg-[#fffcf5] dark:bg-[#1e1710]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md shadow-[0_-8px_24px_rgba(143,100,34,0.05)] z-40">
          <div className="mx-auto flex max-w-lg items-center gap-3 rounded-lg bg-white dark:bg-[#1e1710] border border-[#f0d498] dark:border-[#423321] p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#4a3615] dark:text-[#f0e3ce] mb-1">Audio Player Error</p>
              <p className="text-xs text-[#6b5532] dark:text-[#bda27e] break-words">
                {this.state.error?.message || "An unexpected error occurred with the audio player."}
              </p>
              <p className="text-xs text-[#a88d63] dark:text-[#bda27e] mt-2 italic">Try refreshing the page if the problem persists.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
