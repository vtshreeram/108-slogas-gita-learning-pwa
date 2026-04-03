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
    <html lang="en">
      <head>
        {/* iOS home screen icon — needs a PNG at this path for best results */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* iOS splash / status bar colour matches the app warm background */}
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
