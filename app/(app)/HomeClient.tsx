"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Overline, Glyph, formatINR } from "@/components/ui";
import { useShell } from "@/components/AppShell";

interface T {
  id: string; amount: number; direction: string; kind: string; merchantName?: string;
  account: { id: string; name: string; colorToken: string };
  category: { id: string; name: string; colorToken: string; icon: string } | null;
  transferAccount: { id: string; name: string } | null;
  source: string; txnDatetime: string; confidence: number;
}

export function HomeClient({
  monthSpend, delta, spark, streak, review, recent,
}: { monthSpend: number; delta: number; spark: number[]; streak: { logged: number; of: number }; review: T[]; recent: T[] }) {
  const { openQuickAdd, openEditTxn, toast } = useShell();
  const router = useRouter();
  const [items, setItems] = useState(review);
  const [confirming, setConfirming] = useState<Set<string>>(new Set());

  async function confirm(id: string) {
    if (confirming.has(id)) return;
    setConfirming((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isReviewed: true }) });
      if (!res.ok) throw new Error("confirm failed");
      setItems((x) => x.filter((t) => t.id !== id));
      router.refresh();
    } catch {
      toast("Couldn't confirm — check your connection and try again.");
      setConfirming((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Today</h1>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--warn)", background: "var(--warn-tint)", padding: "5px 10px", borderRadius: 999 }}>
          🔥 {streak.logged} of last {streak.of} days
        </span>
      </div>

      <Card style={{ padding: 20, marginBottom: 16 }}>
        <Overline>Spent this month</Overline>
        <div className="num" style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", margin: "4px 0 2px" }}>{formatINR(monthSpend)}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: delta <= 0 ? "var(--pos)" : "var(--ink-muted)" }}>
          {delta <= 0 ? "▼" : "▲"} {Math.abs(delta)}% <span style={{ color: "var(--ink-subtle)", fontWeight: 400 }}>vs last month</span>
        </div>
        <Sparkline data={spark} />
      </Card>

      {items.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 2px 10px" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>To review</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", padding: "2px 8px", borderRadius: 999 }}>{items.length} new</span>
          </div>
          <Card>
            {items.map((t, idx) => {
              const isConfirming = confirming.has(t.id);
              return (
                <div key={t.id} onClick={() => openEditTxn(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: idx < items.length - 1 ? "1px solid var(--hairline)" : "none", cursor: "pointer" }}>
                  <Glyph token={t.category?.colorToken ?? "misc"} icon={t.category?.icon ?? "•"} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {t.merchantName ?? (t.kind === "TRANSFER" ? `Payment to ${t.transferAccount?.name ?? "card"}` : "Transaction")}
                      {t.kind === "TRANSFER" && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-muted)", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 999 }}>payment</span>}
                      {t.confidence < 0.5 && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--neg)", background: "var(--neg-tint)", padding: "1px 6px", borderRadius: 999 }}>low confidence</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{t.account.name} · {t.source === "EMAIL" ? "email alert" : "imported"}</div>
                  </div>
                  <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{formatINR(t.amount)}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); confirm(t.id); }}
                    disabled={isConfirming}
                    style={{ background: "var(--accent-tint)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: isConfirming ? "default" : "pointer", opacity: isConfirming ? 0.6 : 1, minWidth: 64 }}
                  >
                    {isConfirming ? "Confirming…" : "Confirm"}
                  </button>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 2px 10px" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Recent</span>
        <button onClick={openQuickAdd} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>+ Quick add</button>
      </div>
      <Card>
        {recent.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-subtle)", fontSize: 14 }}>No transactions yet. Press <span className="kbd">A</span> to log one.</div>}
        {recent.map((t, idx) => (
          <div key={t.id} onClick={() => openEditTxn(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: idx < recent.length - 1 ? "1px solid var(--hairline)" : "none", cursor: "pointer" }}>
            <Glyph token={t.category?.colorToken ?? "misc"} icon={t.category?.icon ?? "•"} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {t.merchantName ?? (t.kind === "TRANSFER" ? `Payment to ${t.transferAccount?.name ?? "card"}` : "Transaction")}
                {t.kind === "TRANSFER" && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-muted)", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 999 }}>payment</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{t.account.name} · {new Date(t.txnDatetime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 600, color: t.direction === "CREDIT" ? "var(--pos)" : "var(--ink)" }}>
              {t.direction === "CREDIT" ? formatINR(t.amount, false, true) : formatINR(t.amount)}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 100, h = 34;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 34, marginTop: 12 }}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
