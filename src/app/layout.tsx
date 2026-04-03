import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Noto_Sans_Tamil } from "next/font/google";

const notoSansTamil = Noto_Sans_Tamil({
  variable: "--font-noto-sans-tamil",
  subsets: ["tamil"],
});
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSansTamil.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {process.env.NODE_ENV === "development" && <VisualEditsMessenger />}
        </ThemeProvider>
      </body>
    </html>
  );
}
