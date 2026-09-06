"use client";
import React, { useEffect, useState } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

// Resolved hex, one set per theme — mirrors app/globals.css's :root /
// [data-theme] tokens, using @clerk/ui's actual current variable names (per
// Clerk's own dist/themes/dark.js source and the documented Variables
// reference — NOT the classic Elements API names from memory, which are
// either deprecated aliases (colorText → colorForeground, colorTextSecondary
// → colorMutedForeground, colorInputBackground/colorInputText → colorInput/
// colorInputForeground) or, in the case of `colorScheme`, don't exist in
// this API at all. Passing the wrong/deprecated names is what produced the
// washed-out, low-contrast UI this replaces — some elements read the new
// names and rendered fine, everything else silently fell back to Clerk's
// own (light-oriented) computed defaults on our dark surfaces.
const palettes = {
  dark: {
    colorBackground: "#141418",
    colorForeground: "#FAFAFA",
    colorMutedForeground: "#A1A1AA",
    colorMuted: "#1C1C22",
    colorPrimary: "#8B7CFF",
    colorPrimaryForeground: "#FFFFFF",
    colorNeutral: "#A1A1AA",
    colorInput: "#1C1C22",
    colorInputForeground: "#FAFAFA",
    colorDanger: "#F87171",
    colorSuccess: "#34D399",
    colorWarning: "#FBBF24",
    colorBorder: "#26262E",
    colorRing: "#8B7CFF",
    colorShimmer: "#1C1C22",
    colorModalBackdrop: "rgba(0,0,0,.6)",
  },
  light: {
    colorBackground: "#FFFFFF",
    colorForeground: "#18181B",
    colorMutedForeground: "#52525B",
    colorMuted: "#F4F4F5",
    colorPrimary: "#6D5EF0",
    colorPrimaryForeground: "#FFFFFF",
    colorNeutral: "#71717A",
    colorInput: "#F4F4F5",
    colorInputForeground: "#18181B",
    colorDanger: "#DC2626",
    colorSuccess: "#059669",
    colorWarning: "#B45309",
    colorBorder: "#E9E9EC",
    colorRing: "#6D5EF0",
    colorShimmer: "#F4F4F5",
    colorModalBackdrop: "rgba(0,0,0,.4)",
  },
} as const;

const shared = {
  borderRadius: "10px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
};

// Mirrors AppShell's [data-theme] attribute via a MutationObserver —
// toggleTheme sets that attribute imperatively, not through shared React
// state, so polling the DOM is the only way to stay in sync from here.
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/register"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        // @clerk/ui's own prebuilt dark theme as a safety-net base (covers any
        // slot our explicit palette below doesn't) — only for dark, since
        // there's no equivalent prebuilt "light" theme to layer on top of.
        theme: theme === "dark" ? dark : undefined,
        variables: { ...palettes[theme], ...shared },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
