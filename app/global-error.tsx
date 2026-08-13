"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" data-theme="dark">
      <body style={{ margin: 0, background: "#0A0A0C", color: "#FAFAFA", fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Expenses hit a snag</div>
            <div style={{ fontSize: 13.5, color: "#A1A1AA", marginBottom: 20 }}>Please try again.</div>
            <button
              onClick={reset}
              style={{ background: "linear-gradient(135deg,#8B7CFF 0%,#6D5EF0 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
