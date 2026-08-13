"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ShellAccount } from "@/lib/user";
import { useFocusTrap } from "./ui";

interface Cmd { id: string; label: string; group: string; hint?: string; run: () => void; }

export function CommandPalette({
  accounts, onClose, onAdd, onTheme,
}: { accounts: ShellAccount[]; onClose: () => void; onAdd: () => void; onTheme: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [prevQ, setPrevQ] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useFocusTrap(containerRef, true);

  const commands: Cmd[] = useMemo(() => {
    const nav = (href: string) => () => { router.push(href); onClose(); };
    const base: Cmd[] = [
      { id: "add", label: "Add expense", group: "Actions", hint: "A", run: () => { onAdd(); } },
      { id: "import", label: "Import statement", group: "Actions", hint: "I", run: nav("/import") },
      { id: "export", label: "Export transactions (CSV)", group: "Actions", run: () => { window.location.href = "/api/export?type=csv"; onClose(); } },
      { id: "theme", label: "Toggle dark / light theme", group: "Actions", run: () => { onTheme(); onClose(); } },
      { id: "go-home", label: "Go to Today", group: "Navigate", hint: "G H", run: nav("/") },
      { id: "go-txn", label: "Go to Transactions", group: "Navigate", hint: "G T", run: nav("/transactions") },
      { id: "go-an", label: "Go to Analytics", group: "Navigate", hint: "G A", run: nav("/analytics") },
      { id: "go-acc", label: "Go to Accounts", group: "Navigate", hint: "G C", run: nav("/accounts") },
    ];
    const acc: Cmd[] = accounts.map((a) => ({
      id: "acc-" + a.id, label: `Filter: ${a.name}`, group: "Accounts",
      run: () => { router.push(`/transactions?accountId=${a.id}`); onClose(); },
    }));
    return [...base, ...acc];
  }, [accounts, router, onAdd, onClose, onTheme]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return s ? commands.filter((c) => c.label.toLowerCase().includes(s)) : commands;
  }, [q, commands]);

  // Reset the highlighted row when the query changes — adjusted during render
  // (React's documented pattern for this) rather than in a useEffect, since
  // the effect version fires setState synchronously on every keystroke.
  if (q !== prevQ) {
    setPrevQ(q);
    setI(0);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[i]?.run(); }
    else if (e.key === "Escape") onClose();
  }

  const groups = filtered.reduce<Record<string, Cmd[]>>((acc, c) => { (acc[c.group] ||= []).push(c); return acc; }, {});
  let flat = -1;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 90, display: "flex", justifyContent: "center", paddingTop: "12vh" }} className="anim-fade">
      <div ref={containerRef} role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()} onKeyDown={onKey} className="anim-pop" style={{ width: "100%", maxWidth: 520, height: "fit-content", maxHeight: "70vh", background: "var(--surface-1)", border: "1px solid var(--hairline-strong)", borderRadius: 16, boxShadow: "var(--shadow-e3)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command or search…"
          style={{ padding: "16px 18px", border: "none", borderBottom: "1px solid var(--hairline)", background: "transparent", color: "var(--ink)", fontSize: 16, outline: "none", fontFamily: "inherit" }} />
        <div style={{ overflowY: "auto" }}>
          {Object.entries(groups).map(([g, items]) => (
            <div key={g}>
              <div className="overline" style={{ padding: "12px 18px 6px", fontSize: 11 }}>{g}</div>
              {items.map((c) => {
                flat++;
                const active = flat === i;
                return (
                  <div key={c.id} onMouseEnter={() => setI(filtered.indexOf(c))} onClick={() => c.run()}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", cursor: "pointer", background: active ? "var(--accent-tint)" : "transparent" }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: active ? "var(--accent)" : "var(--ink)" }}>{c.label}</span>
                    {c.hint && <span className="kbd">{c.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 20, color: "var(--ink-subtle)", fontSize: 14 }}>No commands</div>}
        </div>
      </div>
    </div>
  );
}
