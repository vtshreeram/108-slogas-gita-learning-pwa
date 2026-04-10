import type { NextConfig } from "next";

// Loader path from orchids-visual-edits - use direct resolve to get the actual file
const loaderPath = require.resolve('orchids-visual-edits/loader.js');

const nextConfig: NextConfig = {
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

export default nextConfig;
