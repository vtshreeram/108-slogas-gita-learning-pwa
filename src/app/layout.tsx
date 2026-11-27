import type { Metadata } from "next";
import Script from "next/script";
import { Geist } from "next/font/google";
import { Noto_Sans_Tamil } from "next/font/google";

const notoSansTamil = Noto_Sans_Tamil({
  variable: "--font-noto-sans-tamil",
  subsets: ["tamil"],
  // Only the Tamil tab uses it, so do not preload it on every page.
  preload: false,
});
import "./globals.css";
import { DevTools } from "@/components/dev-tools";
import { ErrorReporter } from "@/components/error-reporter";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaUpdates } from "@/components/pwa-updates";
import { LearningProvider } from "@/components/learning-provider";
import { ChapterAudioProvider } from "@/components/chapter-audio-provider";
import { ThemeColor } from "@/components/theme-color";
import { THEME_COLORS } from "@/lib/theme-colors";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gita 108",
  description: "Personal discipline system for memorizing 108 key Bhagavad Gita shlokas through a guided daily loop.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Gita 108",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Gita 108 — Daily Practice",
    description: "Memorize 108 key Bhagavad Gita shlokas through a structured daily loop: listen, repeat, understand, recall.",
    type: "website",
    siteName: "Gita 108",
  },
  twitter: {
    card: "summary",
    title: "Gita 108 — Daily Practice",
    description: "Memorize 108 key Bhagavad Gita shlokas through a structured daily loop.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  // Status bar / Android navigation bar colour: the page background, per theme (ThemeColor keeps it right when the theme is chosen in Profile).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="https://unpkg.com/react-grab@0.2.0/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geistSans.variable} ${notoSansTamil.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeColor />
          <ErrorReporter />
          <a className="skip-link" href="#main-content">Skip to content</a>
          <LearningProvider>
            <PwaUpdates />
            <ChapterAudioProvider>{children}</ChapterAudioProvider>
          </LearningProvider>
          <DevTools />
        </ThemeProvider>
      </body>
    </html>
  );
}
