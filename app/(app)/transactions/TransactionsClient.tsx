"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { ShellAccount, ShellCategory } from "@/lib/user";
import { Dot, Glyph, formatINR, Skeleton } from "@/components/ui";
import { useShell } from "@/components/AppShell";

interface Txn {
  id: string; amount: number; direction: string; kind: string; txnDatetime: string; merchantName?: string;
  paymentRail: string; source: string; isReviewed: boolean;
  account: { id: string; name: string; colorToken: string } | null;
  category: { id: string; name: string; colorToken: string; icon: string } | null;
  transferAccount: { id: string; name: string } | null;
}

export function TransactionsClient({ accounts, categories }: { accounts: ShellAccount[]; categories: ShellCategory[] }) {
  const { openEditTxn } = useShell();
  const sp = useSearchParams();
  const [accountId, setAccountId] = useState(sp.get("accountId") || "");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [dense, setDense] = useState(false);
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [error, setError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setTxns(null);
    setError(false);
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (q) params.set("q", q);
    try {
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setTxns(data.transactions || []);
    } catch {
      setTxns([]);
      setError(true);
    }
  }, [accountId, categoryId, q]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => {
    const f = () => searchRef.current?.focus();
    window.addEventListener("focus-search", f);
    return () => window.removeEventListener("focus-search", f);
  }, []);

  const total = useMemo(() => (txns || []).filter((t) => t.direction === "DEBIT" && t.kind !== "TRANSFER").reduce((a, t) => a + t.amount, 0), [txns]);
  const pad = dense ? "8px 12px" : "12px 12px";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Transactions</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/api/export?type=csv" style={{ fontSize: 13, color: "var(--ink-muted)", textDecoration: "none", border: "1px solid var(--hairline-strong)", padding: "7px 12px", borderRadius: 9 }}>Export CSV</a>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant, note, amount…  ( / )"
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "var(--surface-1)", color: "var(--ink)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
        <Select value={accountId} onChange={setAccountId} placeholder="All accounts" options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
        <Select value={categoryId} onChange={setCategoryId} placeholder="All categories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <button onClick={() => setDense((d) => !d)} style={chipBtn}>{dense ? "Comfortable" : "Compact"}</button>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginBottom: 8 }}>
        {txns ? `${txns.length} transactions · ${formatINR(total)} spent` : "Loading…"}
      </div>

      <div className="table-desktop" style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", borderRadius: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              {["Date", "Merchant", "Category", "Account", "Rail"].map((h) => <th key={h} style={th}>{h}</th>)}
              <th style={{ ...th, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {!txns && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}><td colSpan={6} style={{ padding: "10px 12px" }}><Skeleton h={16} /></td></tr>
            ))}
            {txns && error && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--ink-subtle)" }}>
                Couldn&apos;t load transactions. <button onClick={load} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", font: "inherit" }}>Retry</button>
              </td></tr>
            )}
            {txns && !error && txns.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--ink-subtle)" }}>No transactions match your filters.</td></tr>
            )}
            {txns && !error && txns.map((t) => (
              <tr key={t.id} className="trow" onClick={() => t.account && openEditTxn({ id: t.id, amount: t.amount, merchantName: t.merchantName, category: t.category, account: t.account, kind: t.kind, transferAccount: t.transferAccount })} style={{ borderTop: "1px solid var(--hairline)", cursor: t.account ? "pointer" : "default" }}>
                <td className="num" style={{ ...td, padding: pad, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{new Date(t.txnDatetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                <td style={{ ...td, padding: pad, fontWeight: 600 }}>
                  {t.merchantName ?? (t.kind === "TRANSFER" ? `Payment to ${t.transferAccount?.name ?? "card"}` : "—")}
                  {t.kind === "TRANSFER" && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-muted)", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 999 }}>payment</span>}
                  {!t.isReviewed && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--warn)", background: "var(--warn-tint)", padding: "1px 6px", borderRadius: 999 }}>review</span>}
                </td>
                <td style={{ ...td, padding: pad }}>{t.category ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot token={t.category.colorToken} size={8} />{t.category.name}</span> : <span style={{ color: "var(--ink-subtle)" }}>—</span>}</td>
                <td style={{ ...td, padding: pad, color: "var(--ink-muted)" }}>{t.account?.name}</td>
                <td style={{ ...td, padding: pad, color: "var(--ink-subtle)", fontSize: 12 }}>{t.paymentRail}</td>
                <td className="num" style={{ ...td, padding: pad, textAlign: "right", fontWeight: 600, color: t.direction === "CREDIT" ? "var(--pos)" : "var(--ink)" }}>
                  {t.direction === "CREDIT" ? formatINR(t.amount, true, true) : formatINR(t.amount, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card list — replaces the table below the desktop breakpoint, since a
          6-column table has no room to breathe on an iPhone-width screen. */}
      <div className="list-mobile" style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden" }}>
        {!txns && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: "12px 14px", borderBottom: i < 5 ? "1px solid var(--hairline)" : "none" }}><Skeleton h={34} /></div>
        ))}
        {txns && error && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-subtle)" }}>
            Couldn&apos;t load transactions. <button onClick={load} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", font: "inherit" }}>Retry</button>
          </div>
        )}
        {txns && !error && txns.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-subtle)" }}>No transactions match your filters.</div>
        )}
        {txns && !error && txns.map((t, idx) => (
          <div key={t.id} onClick={() => t.account && openEditTxn({ id: t.id, amount: t.amount, merchantName: t.merchantName, category: t.category, account: t.account, kind: t.kind, transferAccount: t.transferAccount })}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: idx < txns.length - 1 ? "1px solid var(--hairline)" : "none", cursor: t.account ? "pointer" : "default" }}>
            <Glyph token={t.category?.colorToken ?? "misc"} icon={t.category?.icon ?? "•"} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.merchantName ?? (t.kind === "TRANSFER" ? `Payment to ${t.transferAccount?.name ?? "card"}` : "—")}
                </span>
                {t.kind === "TRANSFER" && <span style={{ fontSize: 10, color: "var(--ink-muted)", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 999, flex: "none" }}>payment</span>}
                {!t.isReviewed && <span style={{ fontSize: 10, color: "var(--warn)", background: "var(--warn-tint)", padding: "1px 6px", borderRadius: 999, flex: "none" }}>review</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 1 }}>
                {t.account?.name}{t.category && <> · {t.category.name}</>} · {new Date(t.txnDatetime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </div>
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 600, color: t.direction === "CREDIT" ? "var(--pos)" : "var(--ink)", flex: "none" }}>
              {t.direction === "CREDIT" ? formatINR(t.amount, true, true) : formatINR(t.amount, true)}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .table-desktop{display:none}
        .list-mobile{display:block}
        @media(min-width:820px){
          .table-desktop{display:block}
          .list-mobile{display:none}
        }
      `}</style>
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...chipBtn, appearance: "auto", cursor: "pointer" }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const th: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-subtle)", textAlign: "left", padding: "10px 12px" };
const td: React.CSSProperties = { fontSize: 13.5 };
const chipBtn: React.CSSProperties = { fontSize: 13, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "var(--surface-1)", color: "var(--ink)", fontFamily: "inherit", cursor: "pointer" };
