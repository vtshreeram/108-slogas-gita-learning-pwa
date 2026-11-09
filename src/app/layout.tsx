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
import { ThemeProvider } from "@/components/theme-provider";
import { PwaUpdates } from "@/components/pwa-updates";
import { LearningProvider } from "@/components/learning-provider";

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
  themeColor: "#f4e9cb",
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
            src="//unpkg.com/react-grab/dist/index.global.js"
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
          <a className="skip-link" href="#main-content">Skip to content</a>
          <LearningProvider>
            <PwaUpdates />
            {children}
          </LearningProvider>
          <DevTools />
        </ThemeProvider>
      </body>
    </html>
  );
}
