"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

/** Reports uncaught errors and rejected promises that no error boundary sees. Renders nothing. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, "window-error");
    const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, "unhandled-rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
