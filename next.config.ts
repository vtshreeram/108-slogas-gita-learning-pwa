import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Loader path from orchids-visual-edits - use direct resolve to get the actual file
const loaderPath = require.resolve('orchids-visual-edits/loader.js');

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
        }
        // TODO: Add Content-Security-Policy header when Firebase and other third-party integrations are tested
        // For now, the policy would need to allow: googleapis.com, firebase.com, Google Fonts, and similar
        // Consider enabling in report-only mode first: Content-Security-Policy-Report-Only: ...
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
