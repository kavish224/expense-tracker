import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { ClerkThemeProvider } from "@/components/ClerkThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expenses",
  description: "Personal multi-account expense tracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Expenses" },
  // iOS ignores the manifest's icon list entirely for "Add to Home Screen" —
  // without an explicit apple-touch-icon link, it falls back to a screenshot
  // of the page as the home-screen icon.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
  width: "device-width",
  initialScale: 1,
  // No maximumScale: locking pinch-zoom fails WCAG 1.4.4 (resize text) and the
  // app's own AA+ accessibility bar (FSD 7) for low-vision users.
  viewportFit: "cover",
};

// Set theme before paint to avoid flash. Default: dark.
const themeInit = `
(function(){try{
  var t = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        {/* next/script positions itself — it must not be nested in <head>, or Next's
            beforeInteractive machinery is bypassed and it renders as a plain <script>
            DOM node instead, which React 19 flags since it never executes one on the client. */}
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
        <ClerkThemeProvider>
          {children}
        </ClerkThemeProvider>
        <Toaster
          position="bottom-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--surface-1)",
              border: "1px solid var(--hairline-strong)",
              color: "var(--ink)",
              boxShadow: "var(--shadow-e2)",
            },
          }}
        />
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`}
        </Script>
      </body>
    </html>
  );
}
