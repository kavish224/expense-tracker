"use client";
import React, { useEffect, useState } from "react";

const DISMISS_KEY = "installPromptDismissedAt";
const DISMISS_DAYS = 14;
const MIN_VISITS = 2;
const VISITS_KEY = "visitCount";

function isIos() {
  const ua = window.navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "Macintosh" but exposes touch points, unlike a real Mac.
  const iPadOS13 = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS13;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

// iOS Safari has no `beforeinstallprompt` event — the only path to installing
// is Share → Add to Home Screen, which isn't discoverable on its own. This
// surfaces that path explicitly, after the user has shown some intent to
// return (not on their very first page load).
export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const daysSince = (Date.now() - dismissedAt) / 86400000;
    if (dismissedAt && daysSince < DISMISS_DAYS) return;

    const visits = Number(localStorage.getItem(VISITS_KEY) || 0) + 1;
    localStorage.setItem(VISITS_KEY, String(visits));
    if (visits < MIN_VISITS) return;

    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  if (!show) return null;

  return (
    <div role="dialog" aria-label="Install app" className="anim-pop" style={wrap}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-grad)", flex: "none", boxShadow: "0 2px 10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.2)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Install Expenses</div>
          <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 1 }}>
            Tap <b>Share</b> <ShareGlyph /> then <b>Add to Home Screen</b>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" style={closeBtn}>✕</button>
      </div>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -2 }}>
      <path d="M12 3v13" /><path d="M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed", left: 12, right: 12, bottom: "calc(78px + env(safe-area-inset-bottom))",
  background: "var(--surface-1)", border: "1px solid var(--hairline-strong)", borderRadius: 14,
  padding: "12px 12px 12px 14px", boxShadow: "var(--shadow-e3)", zIndex: 65, maxWidth: 420, margin: "0 auto",
};
const closeBtn: React.CSSProperties = {
  background: "var(--surface-2)", border: "none", color: "var(--ink-subtle)", cursor: "pointer",
  width: 26, height: 26, borderRadius: 999, fontSize: 12, flex: "none",
};
