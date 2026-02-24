import type { NextConfig } from "next";
// @ts-expect-error next-pwa missing accurate TS definitions
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  disable: process.env.NODE_ENV === "development",
  // By passing an empty array to runtimeCaching, we entirely disable all dynamic runtime 
  // caching. This ensures /api/* paths and dynamically fetched data are NEVER cached by the
  // Service Worker, ensuring 100% fresh financial data at all times.
  // Workbox will natively still precache the core _next/static JS/CSS assets for performance.
  runtimeCaching: [],
  // Prevent caching of building artifacts/pages which might cause stale deployments
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version
      ? `v${process.env.npm_package_version}-${Date.now()}`
      : `v1.0.0-${Date.now()}`
  },
  turbopack: {},
};

export default withPWA(nextConfig);
