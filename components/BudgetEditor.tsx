"use client";
import React, { useEffect, useRef, useState } from "react";
import { Dot, useFocusTrap } from "./ui";
import { useShell } from "./AppShell";

interface BudgetRow {
  id: string;
  amount: number;
  period: "MONTHLY" | "WEEKLY";
  categoryId: string | null;
}

export function BudgetEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { categories } = useShell();
  const [existing, setExisting] = useState<BudgetRow[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({}); // key: categoryId or "overall"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true);

  useEffect(() => {
    fetch("/api/budgets").then((r) => r.json()).then((d) => {
      const rows: BudgetRow[] = d.budgets ?? [];
      setExisting(rows);
      const v: Record<string, string> = {};
      for (const b of rows) v[b.categoryId ?? "overall"] = String(b.amount);
      setValues(v);
    }).catch(() => setExisting([]));
  }, []);

  function setValue(key: string, raw: string) {
    if (raw && !/^\d*\.?\d{0,2}$/.test(raw)) return;
    setValues((v) => ({ ...v, [key]: raw }));
  }

  async function save() {
    if (!existing) return;
    setSaving(true);
    setError("");
    try {
      const keys = ["overall", ...categories.map((c) => c.id)];
      await Promise.all(keys.map(async (key) => {
        const raw = (values[key] ?? "").trim();
        const found = existing.find((b) => (b.categoryId ?? "overall") === key);
        const amount = raw ? parseFloat(raw) : 0;
        if (amount > 0) {
          await fetch(found ? `/api/budgets/${found.id}` : "/api/budgets", {
            method: found ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(found ? { amount } : { categoryId: key === "overall" ? null : key, amount }),
          });
        } else if (found) {
          await fetch(`/api/budgets/${found.id}`, { method: "DELETE" });
        }
      }));
      onSaved();
      onClose();
    } catch {
      setError("Couldn't save budgets — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={overlay} className="anim-fade">
      <div ref={containerRef} role="dialog" aria-modal="true" aria-label="Edit budgets" onClick={(e) => e.stopPropagation()} className="anim-pop" style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Edit budgets</div>
          <button autoFocus onClick={onClose} aria-label="Close" style={closeBtn}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 14 }}>Set a monthly cap per category, or an overall cap. Leave blank to remove.</div>

        {existing === null ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "var(--ink-subtle)", fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            <Row label="Overall" value={values.overall ?? ""} onChange={(v) => setValue("overall", v)} bold />
            {categories.filter((c) => c.colorToken !== "income").map((c) => (
              <Row key={c.id} label={c.name} token={c.colorToken} value={values[c.id] ?? ""} onChange={(v) => setValue(c.id, v)} />
            ))}
          </div>
        )}

        {error && <div role="alert" style={{ color: "var(--neg)", fontSize: 13, marginTop: 10 }}>{error}</div>}
        <button onClick={save} disabled={saving || existing === null} className="btn-x btn-p" style={saveBtn}>
          {saving ? "Saving…" : "Save budgets"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, token, value, onChange, bold }: { label: string; token?: string; value: string; onChange: (v: string) => void; bold?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--hairline)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: bold ? 600 : 500 }}>
        {token && <Dot token={token} size={8} />}{label}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "var(--surface-2)", borderRadius: 8, padding: "5px 9px" }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>₹</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          style={{ width: 76, textAlign: "right", background: "transparent", border: "none", outline: "none", color: "var(--ink)", fontSize: 13.5, fontFamily: "inherit" }}
          className="num"
        />
      </span>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 80, padding: 16 };
const panel: React.CSSProperties = { width: "100%", maxWidth: 420, background: "var(--surface-1)", border: "1px solid var(--hairline-strong)", borderRadius: 18, padding: 20, boxShadow: "var(--shadow-e3)" };
const closeBtn: React.CSSProperties = { background: "var(--surface-2)", border: "none", color: "var(--ink-subtle)", cursor: "pointer", width: 26, height: 26, borderRadius: 999, fontSize: 12 };
const saveBtn: React.CSSProperties = { width: "100%", marginTop: 16, background: "var(--accent-grad)", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.16)" };
