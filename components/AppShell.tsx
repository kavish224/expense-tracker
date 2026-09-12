"use client";
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { toast as sonnerToast } from "sonner";
import type { ShellAccount, ShellCategory } from "@/lib/user";
import { useFocusTrap } from "./ui";
import { QuickAdd, type EditableTxn } from "./QuickAdd";
import { CommandPalette } from "./CommandPalette";
import { InstallPrompt } from "./InstallPrompt";

interface ShellCtx {
  toast: (msg: string, undo?: () => void) => void;
  openQuickAdd: () => void;
  openEditTxn: (txn: EditableTxn) => void;
  openPalette: () => void;
  categories: ShellCategory[];
  accounts: ShellAccount[];
}
const Ctx = createContext<ShellCtx | null>(null);
export const useShell = () => useContext(Ctx)!;

const NAV = [
  { href: "/", label: "Today", key: "H", icon: "◎" },
  { href: "/transactions", label: "Transactions", key: "T", icon: "≣" },
  { href: "/expenses", label: "Expenses", key: "E", icon: "◆" },
  { href: "/settlements", label: "Settlements", key: "L", icon: "⇄" },
  { href: "/statements", label: "Statements", key: "M", icon: "▤" },
  { href: "/analytics", label: "Analytics", key: "A", icon: "▤" },
  { href: "/investments", label: "Investments", key: "V", icon: "◈" },
  { href: "/accounts", label: "Accounts", key: "C", icon: "▦" },
  { href: "/networth", label: "Net Worth", key: "N", icon: "◈" },
  { href: "/import", label: "Import", key: "I", icon: "↥" },
  { href: "/settings", label: "Settings", key: "S", icon: "⚙" },
];

export function AppShell({
  accounts, categories, children,
}: { accounts: ShellAccount[]; categories: ShellCategory[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const [quickAdd, setQuickAdd] = useState(false);
  const [editTxn, setEditTxn] = useState<EditableTxn | null>(null);
  const [palette, setPalette] = useState(false);
  const [cheat, setCheat] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof window === "undefined" ? "dark" : (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );
  const leader = useRef(false);

  // Sonner (rendered once, globally, in app/layout.tsx) owns stacking, timing,
  // and swipe-to-dismiss — this just adapts our existing toast(msg, undo?) call
  // signature onto its API instead of the hand-rolled timer/fixed-div version.
  const toast = useCallback((msg: string, undo?: () => void) => {
    sonnerToast(msg, undo ? { action: { label: "Undo", onClick: undo } } : undefined);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      return next;
    });
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName) || el?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (typing) return;
      if (leader.current) {
        leader.current = false;
        const target = NAV.find((n) => n.key.toLowerCase() === e.key.toLowerCase());
        if (target) { router.push(target.href); return; }
      }
      if (e.key.toLowerCase() === "g") { leader.current = true; setTimeout(() => (leader.current = false), 1200); return; }
      if (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "n") { e.preventDefault(); setQuickAdd(true); }
      else if (e.key === "/") { e.preventDefault(); window.dispatchEvent(new CustomEvent("focus-search")); }
      else if (e.key === "?") { setCheat(true); }
      else if (e.key === "Escape") { setPalette(false); setQuickAdd(false); setCheat(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const ctx: ShellCtx = { toast, openQuickAdd: () => setQuickAdd(true), openEditTxn: (txn) => setEditTxn(txn), openPalette: () => setPalette(true), categories, accounts };

  return (
    <Ctx.Provider value={ctx}>
      <div style={{ display: "flex", minHeight: "100dvh" }}>
        {/* Desktop rail */}
        <aside className="rail-desktop" style={rail}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 20px", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--accent-grad)", boxShadow: "0 2px 10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.2)" }} />
            Expenses
          </div>
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link key={n.href} href={n.href} style={{ ...navItem, ...(active ? navActive : {}) }}>
                <span style={{ width: 18, textAlign: "center", opacity: 0.9 }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                <span className="kbd" style={{ opacity: 0.6 }}>{n.key}</span>
              </Link>
            );
          })}
          <button onClick={() => setQuickAdd(true)} className="btn-x btn-p" style={{ ...navItem, marginTop: 10, background: "var(--accent-grad)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, justifyContent: "center", boxShadow: "0 2px 12px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.16)" }}>
            + Add expense
          </button>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            <button onClick={() => setPalette(true)} style={miniBtn}>⌘K Command</button>
            <button onClick={toggleTheme} style={miniBtn}>{theme === "dark" ? "☀ Light" : "☾ Dark"}</button>
            <button onClick={() => signOut({ redirectUrl: "/login" })} style={{ ...miniBtn, width: "100%" }}>⏻ Log out</button>
          </div>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>{children}</main>

        {/* Mobile tab bar */}
        <nav className="tabbar-mobile glass" style={tabbar}>
          {NAV.slice(0, 2).map((n) => <TabItem key={n.href} n={n} active={pathname === n.href} />)}
          <button onClick={() => setQuickAdd(true)} aria-label="Add expense" style={fab}>+</button>
          {NAV.slice(2, 4).map((n) => <TabItem key={n.href} n={n} active={pathname === n.href} />)}
        </nav>
      </div>

      {quickAdd && <QuickAdd accounts={accounts} categories={categories} onClose={() => setQuickAdd(false)} onSaved={(m) => { toast(m); router.refresh(); }} />}
      {editTxn && <QuickAdd accounts={accounts} categories={categories} editTxn={editTxn} onClose={() => setEditTxn(null)} onSaved={(m) => { toast(m); router.refresh(); }} />}
      {palette && <CommandPalette accounts={accounts} onClose={() => setPalette(false)} onAdd={() => { setPalette(false); setQuickAdd(true); }} onTheme={toggleTheme} />}
      {cheat && <Cheatsheet onClose={() => setCheat(false)} />}
      <InstallPrompt />

      <style>{`
        .rail-desktop{display:none}
        .tabbar-mobile{display:flex}
        @media(min-width:820px){
          .rail-desktop{display:flex}
          .tabbar-mobile{display:none}
          main{padding-bottom:0 !important}
        }
      `}</style>
    </Ctx.Provider>
  );
}

function TabItem({ n, active }: { n: (typeof NAV)[number]; active: boolean }) {
  return (
    <Link href={n.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500, color: active ? "var(--accent)" : "var(--ink-subtle)", textDecoration: "none" }}>
      <span style={{ fontSize: 18 }}>{n.icon}</span>{n.label}
    </Link>
  );
}

function Cheatsheet({ onClose }: { onClose: () => void }) {
  const rows = [["A / N", "New expense"], ["⌘K", "Command palette"], ["/", "Focus search"], ["G then T/A/H/C/I", "Navigate"], ["?", "This sheet"], ["Esc", "Close"]];
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true);
  return (
    <div onClick={onClose} style={overlay}>
      <div ref={containerRef} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()} className="anim-pop" style={{ background: "var(--surface-1)", border: "1px solid var(--hairline-strong)", borderRadius: 16, padding: 22, width: 340, boxShadow: "var(--shadow-e3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>Keyboard shortcuts</div>
          <button autoFocus onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--ink-subtle)", cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
            <span className="kbd">{k}</span><span style={{ color: "var(--ink-muted)" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const rail: React.CSSProperties = { width: 208, flex: "none", borderRight: "1px solid var(--glass-border)", padding: "16px 12px", flexDirection: "column", gap: 2, position: "sticky", top: 0, height: "100dvh", background: "var(--glass-bg)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" };
const navItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", minHeight: 44, borderRadius: 9, fontSize: 13.5, color: "var(--ink-muted)", fontWeight: 500, textDecoration: "none" };
const navActive: React.CSSProperties = { background: "var(--accent-tint)", color: "var(--accent)", fontWeight: 600 };
// minHeight 44px meets the WCAG 2.5.5 / FSD 7 tap-target minimum even though these
// sit in the desktop rail, not just mobile — pointer users benefit too.
const miniBtn: React.CSSProperties = { textAlign: "left", background: "transparent", border: "none", color: "var(--ink-subtle)", fontSize: 12.5, padding: "7px 11px", minHeight: 44, display: "flex", alignItems: "center", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };
// height is additive with the safe-area inset (not `62` alone) — with the global
// box-sizing: border-box rule, a fixed height swallows padding-bottom out of that
// budget instead of adding to it, which on notch iPhones squeezed the icon+label
// stack shorter than it needs and pushed it to overflow above the bar's background.
const tabbar: React.CSSProperties = { position: "fixed", bottom: 0, left: 0, right: 0, height: "calc(62px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--glass-border)", alignItems: "center", justifyContent: "space-around", padding: "0 12px", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 40 };
const fab: React.CSSProperties = { width: 48, height: 48, borderRadius: 16, background: "var(--accent-grad)", color: "#fff", border: "none", fontSize: 26, fontWeight: 300, marginTop: -20, boxShadow: "0 6px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.2)", cursor: "pointer" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 60 };
