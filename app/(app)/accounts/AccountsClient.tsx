"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Glyph, Button, formatINR } from "@/components/ui";
import { useShell } from "@/components/AppShell";

interface Acc {
  id: string; name: string; type: string; colorToken: string; icon: string;
  identifierHint?: string | null; institution?: string | null; spent: number; count: number;
  currentBalance?: number | null;
}

const MANUAL_TYPES = new Set(["INVESTMENT", "LOAN", "OTHER_ASSET"]);

// Shared shape for both the "add new" and "edit existing" modal — same fields
// either way, only the submit target (POST vs PATCH) differs.
interface FormState { id?: string; name: string; type: string; institution: string; identifierHint: string; currentBalance: string }

export function AccountsClient({ accounts }: { accounts: Acc[] }) {
  const router = useRouter();
  const { toast } = useShell();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setForm({ name: "", type: "CREDIT_CARD", institution: "", identifierHint: "", currentBalance: "" });
  }
  function openEdit(a: Acc) {
    setForm({ id: a.id, name: a.name, type: a.type, institution: a.institution ?? "", identifierHint: a.identifierHint ?? "", currentBalance: a.currentBalance != null ? String(a.currentBalance) : "" });
  }

  async function save() {
    if (!form || !form.name || saving) return;
    setSaving(true);
    try {
      const icon = { BANK: "🏦", CASH: "💵", INVESTMENT: "📈", LOAN: "🏷️", OTHER_ASSET: "💎" }[form.type] ?? "💳";
      const payload = {
        name: form.name, type: form.type,
        institution: form.institution || undefined,
        identifierHint: form.identifierHint || undefined,
        colorToken: "misc", icon,
        currentBalance: MANUAL_TYPES.has(form.type) ? Number(form.currentBalance || 0) : undefined,
      };
      const res = form.id
        ? await fetch(`/api/accounts/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("save failed");
      setForm(null);
      router.refresh();
    } catch {
      toast(`Couldn't ${form.id ? "save" : "add"} account — check your connection and try again.`);
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this account? Its history is preserved.")) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("archive failed");
      router.refresh();
    } catch {
      toast("Couldn't archive account — check your connection and try again.");
    }
  }

  const label = (t: string) =>
    ({ BANK: "Bank", CREDIT_CARD: "Credit card", CASH: "Cash", INVESTMENT: "Investment", LOAN: "Loan", OTHER_ASSET: "Other asset" }[t] ?? t);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Accounts</h1>
        <Button onClick={openAdd} size="sm">+ Add account</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {accounts.map((a) => (
          <Card key={a.id} lift style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <Glyph token={a.colorToken} icon={a.icon} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{label(a.type)}{a.identifierHint ? ` · ••${a.identifierHint}` : ""}</div>
              </div>
            </div>
            {MANUAL_TYPES.has(a.type) ? (
              <>
                <div className="overline" style={{ fontSize: 10 }}>{a.type === "LOAN" ? "Amount owed" : "Current balance"}</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>{formatINR(a.currentBalance ?? 0)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 2 }}>Manually tracked</div>
              </>
            ) : (
              <>
                <div className="overline" style={{ fontSize: 10 }}>This month</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>{formatINR(a.spent)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 2 }}>{a.count} transactions</div>
              </>
            )}
            <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
              <button onClick={() => openEdit(a)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>Edit</button>
              {a.type !== "CASH" && <button onClick={() => archive(a.id)} style={{ background: "none", border: "none", color: "var(--ink-subtle)", fontSize: 12, cursor: "pointer", padding: 0 }}>Archive</button>}
            </div>
          </Card>
        ))}
      </div>

      {form && (
        <div onClick={() => setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 80 }} className="anim-fade">
          <Card onClick={(e) => e.stopPropagation()} style={{ padding: 22, width: 340 }} className="anim-pop">
            <div style={{ fontWeight: 600, marginBottom: 14 }}>{form.id ? "Edit account" : "Add account"}</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Account name (e.g. HDFC Credit Card)"
              style={inputStyle} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
              <option value="CREDIT_CARD">Credit card</option>
              <option value="BANK">Bank</option>
              <option value="CASH">Cash</option>
              <option value="INVESTMENT">Investment</option>
              <option value="LOAN">Loan</option>
              <option value="OTHER_ASSET">Other asset</option>
            </select>
            {form.type !== "CASH" && !MANUAL_TYPES.has(form.type) && (
              <>
                <input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Bank name (e.g. hdfcbank)"
                  style={inputStyle} />
                <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", margin: "-6px 0 10px" }}>
                  Matches the sender domain in bank alert emails (e.g. alerts@<b>hdfcbank</b>.com) — helps auto-sort emailed transactions to the right account.
                </div>
                <input value={form.identifierHint} onChange={(e) => setForm({ ...form, identifierHint: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Last 4 digits (optional, most accurate)"
                  style={{ ...inputStyle, marginBottom: 16 }} />
              </>
            )}
            {MANUAL_TYPES.has(form.type) && (
              <>
                <input value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: e.target.value.replace(/[^0-9.]/g, "") })}
                  placeholder={form.type === "LOAN" ? "Amount owed" : "Current balance"} inputMode="decimal" style={inputStyle} />
                <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", margin: "-6px 0 16px" }}>
                  {form.type === "LOAN" ? "Enter as a positive amount — counted against your net worth." : "Not fed by transactions — update this whenever the real value changes."}
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.name}>{saving ? (form.id ? "Saving…" : "Adding…") : form.id ? "Save" : "Add"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "var(--surface-1)", color: "var(--ink)", fontFamily: "inherit", marginBottom: 10 };
