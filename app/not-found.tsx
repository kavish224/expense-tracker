import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg-canvas)", color: "var(--ink)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>404</div>
        <div style={{ fontSize: 14, color: "var(--ink-muted)", marginBottom: 20 }}>This page doesn&apos;t exist.</div>
        <Link href="/" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>← Back home</Link>
      </div>
    </div>
  );
}
