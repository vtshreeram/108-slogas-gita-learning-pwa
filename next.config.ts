import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Loader path from orchids-visual-edits - use direct resolve to get the actual file
const loaderPath = require.resolve('orchids-visual-edits/loader.js');

const audioOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_CHAPTER_AUDIO_BASE ?? "").origin; } catch { return ""; } })();
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  `media-src 'self' blob: ${audioOrigin}`.trim(),
  `connect-src 'self' ${audioOrigin} https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com`.replace(/\s+/g, " "),
  "frame-src https://*.firebaseapp.com https://accounts.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/api/chapters/*": ["./src/data/gita/*.json"],
  },
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [loaderPath]
      }
    }
  },
  // Security headers to prevent common attacks
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff"
        },
        {
          key: "X-Frame-Options",
          value: "DENY"
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin"
        },
        {
          key: "Permissions-Policy",
          value: "geolocation=(), microphone=(), camera=()"
        },
        // Report-only: violations show in the browser console without blocking anything. Tighten and switch
        // to "Content-Security-Policy" once a release has run clean. Next.js hydration and next-themes need inline scripts.
        { key: "Content-Security-Policy-Report-Only", value: CSP },
      ],
    },
  ],
} as NextConfig;

const configForPhase = (phase: string): NextConfig => ({
  ...nextConfig,
  // Locally, a production build must not overwrite a running Turbopack dev server, so it uses its
  // own folder. Vercel (which sets VERCEL=1) expects the default ".next" output directory.
  distDir: phase === PHASE_DEVELOPMENT_SERVER || process.env.VERCEL ? ".next" : ".next-build",
});

export default configForPhase;
