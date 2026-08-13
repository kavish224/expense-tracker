"use client";
import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShellAccount } from "@/lib/user";
import { Card, Overline, Dot, Button, ConfidenceTag, formatINR } from "@/components/ui";

interface Row {
  rowIndex: number; date: string; narration: string; merchantName?: string; categoryKey: string; categoryName: string;
  amount: number; direction: string; rail: string; externalRef?: string; confidence: number;
  dedupStatus: "NEW" | "DUPLICATE" | "PROBABLE"; dedupMatchId: string | null; needsReview: boolean;
}
interface ParseResult {
  accountId: string; fileName: string; tieOut: { status: string; balanced: boolean; offBy: number; opening: number | null; closing: number | null; badRows: number[] };
  summary: { total: number; verified: number; review: number; duplicates: number }; rows: Row[];
}

export function ImportClient({ accounts }: { accounts: ShellAccount[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [committed, setCommitted] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setLoading(true); setCommitted(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("accountId", accountId);
    try {
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "Parse failed"); return; }
      const data: ParseResult = await res.json();
      setResult(data); setRows(data.rows);
    } catch {
      alert("Couldn't reach the server — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!result) return;
    setLoading(true);
    const payload = {
      accountId: result.accountId, fileName: result.fileName, tieOutStatus: result.tieOut.status,
      rows: rows.map((r) => ({ ...r, action: (r as any)._action || (r.dedupStatus === "DUPLICATE" ? "MERGE" : "ADD") })),
    };
    try {
      const res = await fetch("/api/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "Commit failed"); return; }
      const d = await res.json();
      setCommitted(`Added ${d.added}, merged ${d.merged}, skipped ${d.skipped}.`); setResult(null); setRows([]); router.refresh();
    } catch {
      alert("Couldn't reach the server — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const tie = result?.tieOut;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Import statement</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 18 }}>Upload a CSV or XLSX bank/card statement. We verify the balance tie-out, flag duplicates against what you&apos;ve already logged, and only auto-accept what checks out.</p>

      {committed && <Card style={{ padding: 16, marginBottom: 16, background: "var(--pos-tint)", border: "none", color: "var(--pos)", fontWeight: 600 }}>{committed}</Card>}

      {!result && (
        <Card style={{ padding: 24 }}>
          <Overline style={{ marginBottom: 10 }}>Account</Overline>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "var(--surface-1)", color: "var(--ink)", fontFamily: "inherit", marginBottom: 18, display: "block", minWidth: 220 }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            style={{ border: "1.5px dashed var(--hairline-strong)", borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer", color: "var(--ink-muted)" }}>
            {loading ? "Parsing…" : <>Drop a .csv / .xlsx here, or <span style={{ color: "var(--accent)", fontWeight: 600 }}>browse</span></>}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
        </Card>
      )}

      {result && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13.5, fontWeight: 500,
            background: tie?.balanced ? "var(--pos-tint)" : "var(--warn-tint)", color: tie?.balanced ? "var(--pos)" : "var(--warn)" }}>
            <span style={{ width: 20, height: 20, borderRadius: 999, background: tie?.balanced ? "var(--pos)" : "var(--warn)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{tie?.balanced ? "✓" : "!"}</span>
            {tie?.status === "NA"
              ? "No running balance in file — verified by control totals & per-row checks."
              : tie?.balanced
                ? `Balanced: opening ${money(tie.opening)} + credits − debits = closing ${money(tie.closing)}`
                : `Off by ${formatINR(Math.abs(tie?.offBy || 0), true)} — ${tie?.badRows.length || 0} row(s) need review`}
          </div>

          <div style={{ fontSize: 13, color: "var(--ink-subtle)", marginBottom: 10 }}>
            {result.summary.total} rows · {result.summary.verified} verified · {result.summary.review} to review · {result.summary.duplicates} duplicates
          </div>

          <div style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Date", "Narration", "Category", "Amount", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowIndex} style={{ borderTop: "1px solid var(--hairline)", background: r.needsReview ? "var(--warn-tint)" : "transparent" }}>
                    <td className="num" style={{ ...td, whiteSpace: "nowrap", color: "var(--ink-muted)" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                    <td style={{ ...td, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.merchantName || r.narration}</td>
                    <td style={{ ...td }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot token={colorFor(r.categoryKey)} size={8} />{r.categoryName}</span></td>
                    <td className="num" style={{ ...td, fontWeight: 600 }}>{formatINR(r.amount, true)}</td>
                    <td style={{ ...td }}>
                      {r.dedupStatus === "DUPLICATE" ? <span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>dup → merge</span>
                        : r.dedupStatus === "PROBABLE" ? <ConfidenceTag status="review" />
                        : r.needsReview ? <ConfidenceTag status="review" /> : <ConfidenceTag status="verified" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={commit} disabled={loading}>{loading ? "Committing…" : `Commit ${rows.length} rows`}</Button>
            <Button variant="ghost" onClick={() => { setResult(null); setRows([]); }}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}

function money(v: number | null) { return v == null ? "—" : formatINR(v, true); }
function colorFor(key: string) { return key === "shopping" ? "shop" : key === "entertainment" ? "ent" : key; }
const th: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-subtle)", textAlign: "left", padding: "10px 12px" };
const td: React.CSSProperties = { fontSize: 13, padding: "10px 12px" };
