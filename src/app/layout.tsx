import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import AddExpenseModal from "@/components/AddExpenseModal";
import StoreInitializer from "@/components/StoreInitializer";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Personal expense tracker — local-first PWA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Expenses",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131722" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body
        className="font-sans antialiased text-(--color-text-primary)"
      >
        <ThemeProvider>
          <ToastProvider>
            <StoreInitializer />
            {/* Header: fixed at top, respects safe-area-inset-top */}
            <Header />
            {/* Scroll area: sits between fixed header and fixed nav */}
            <div
              id="scroll-container"
              className="overflow-y-auto overscroll-none bg-(--color-bg)"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                paddingTop: 'calc(env(safe-area-inset-top) + 44px)',
                paddingBottom: 'calc(max(env(safe-area-inset-bottom), 20px) + 49px)',
              }}
            >
              {children}
            </div>
            {/* Nav: fixed at bottom, fills safe area below */}
            <BottomNav />
            <AddExpenseModal />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
