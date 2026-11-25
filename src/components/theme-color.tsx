"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { THEME_COLORS } from "@/lib/theme-colors";

/**
 * The server sends one theme-color per OS colour scheme. When the learner picks Light or Dark in Profile
 * (overriding the OS), point every theme-color tag at the chosen theme so Android's status and navigation bars follow.
 */
export function ThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = THEME_COLORS[resolvedTheme];
  }, [resolvedTheme]);
  return null;
}
