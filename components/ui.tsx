"use client";
import React, { useEffect, useRef } from "react";

export function colorVar(token: string) {
  return `var(--c-${token})`;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab focus within a modal/overlay container while it's open,
 * and restores focus to whatever was focused before it opened once it closes
 * (FSD 7 accessibility requirement) — otherwise focus silently falls back to
 * <body> and keyboard users lose their place in the page behind the overlay.
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    triggerRef.current = document.activeElement as HTMLElement | null;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [active, containerRef]);
}

export function formatINR(value: number, decimals = false, sign = false) {
  const neg = value < 0;
  const abs = Math.abs(value);
  const s = abs.toLocaleString("en-IN", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `${neg ? "-₹" : sign ? "+₹" : "₹"}${s}`;
}

export function Card({ children, style, className, lift, onClick }: { children: React.ReactNode; style?: React.CSSProperties; className?: string; lift?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <div
      className={`${lift ? "lift" : ""} ${className ?? ""}`}
      onClick={onClick}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hairline)",
        borderRadius: 16,
        boxShadow: "var(--card-highlight), var(--shadow-e1)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Overline({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="overline" style={style}>{children}</div>;
}

export function Dot({ token, size = 10 }: { token: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: colorVar(token), display: "inline-block", flex: "none" }} />;
}

export function Glyph({ token, icon, size = 36 }: { token: string; icon: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.26, background: colorVar(token), display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.44, flex: "none" }}>
      {icon}
    </span>
  );
}

export function Button({
  children, onClick, variant = "primary", size = "md", type = "button", disabled, style,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md"; type?: "button" | "submit"; disabled?: boolean; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    fontFamily: "inherit", fontWeight: 600, borderRadius: 10, cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent", transition: "background .14s, transform .12s, box-shadow .14s, filter .14s",
    fontSize: size === "sm" ? 13 : 14, padding: size === "sm" ? "7px 14px" : "10px 17px",
    opacity: disabled ? 0.5 : 1, letterSpacing: "-0.01em",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent-grad)", color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.16)" },
    secondary: { background: "var(--surface-2)", color: "var(--ink)", borderColor: "var(--hairline-strong)" },
    ghost: { background: "transparent", color: "var(--ink-muted)" },
  };
  const cls = `btn-x btn-${variant === "primary" ? "p" : variant === "secondary" ? "s" : "g"}`;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={disabled ? undefined : cls} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Skeleton({ w = "100%", h = 14, style }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

export function ConfidenceTag({ status }: { status: "verified" | "review" }) {
  const verified = status === "verified";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
      background: verified ? "var(--pos-tint)" : "var(--warn-tint)",
      color: verified ? "var(--pos)" : "var(--warn)",
    }}>
      {verified ? "Verified" : "Review"}
    </span>
  );
}
