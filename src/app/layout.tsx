import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";

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
        <link rel="apple-touch-icon" href="/icon.svg" />
        {/* iOS splash / status bar colour matches the app warm background */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === "development" && <VisualEditsMessenger />}
      </body>
    </html>
  );
}
