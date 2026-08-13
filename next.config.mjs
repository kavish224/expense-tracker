/** @type {import('next').NextConfig} */
// Clerk-required additions, per https://clerk.com/docs/security/clerk-csp:
// script/connect/frame-src need its Frontend API + bot-protection domains, img-src
// needs its avatar CDN, worker-src needs blob: for its web worker. 'unsafe-eval' in
// script-src is dev-only (React's dev-mode debugging needs it; never ship it to prod).
//
// Clerk's Frontend API domain differs by instance: the Development instance serves
// from *.clerk.accounts.dev, while the Production instance (once a custom domain is
// configured — see /docs Clerk-domain-migration notes) serves from clerk.<our own
// domain>. Both are allow-listed so preview/dev deploys and production both work.
const dev = process.env.NODE_ENV !== "production";
const clerkFrontendApi = "https://clerk.expense.kavishambani.in";
const csp = [
  "default-src 'self'",
  // Next injects small static inline bootstrap scripts (theme-init, SW register) with no nonce wiring today.
  `script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev ${clerkFrontendApi} https://challenges.cloudflare.com https://*.protect.clerk.com${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://img.clerk.com",
  "font-src 'self'",
  `connect-src 'self' https://*.clerk.accounts.dev ${clerkFrontendApi} https://*.protect.clerk.com`,
  "worker-src 'self' blob:",
  `frame-src https://challenges.cloudflare.com https://*.protect.clerk.com https://*.clerk.accounts.dev ${clerkFrontendApi}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  // Service worker + manifest are served statically from /public.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Icons are content-hashed by filename only in intent, not in practice — they
      // rarely change, so cache them hard on iOS's home-screen launch path.
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // sw.js controls app-update delivery: it must always be revalidated so a new
      // deploy's service worker (and its cache-busted CACHE name) is picked up
      // promptly instead of iOS Safari serving a stale cached copy indefinitely.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
    ];
  },
};
export default nextConfig;
