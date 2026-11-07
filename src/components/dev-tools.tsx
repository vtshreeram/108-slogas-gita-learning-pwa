"use client";
import dynamic from "next/dynamic";

// The visual-editing overlay is a development aid. NODE_ENV is a build-time constant, so in production
// this branch (and the package behind it) is removed from the bundle instead of being shipped to every learner.
const VisualEditsMessenger = process.env.NODE_ENV === "development"
  ? dynamic(() => import("orchids-visual-edits").then((m) => m.VisualEditsMessenger))
  : () => null;

export function DevTools() { return <VisualEditsMessenger />; }
