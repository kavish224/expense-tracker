"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Card, Overline, Dot, Skeleton, formatINR } from "@/components/ui";
import { Heatmap } from "@/components/Heatmap";
import { BudgetEditor } from "@/components/BudgetEditor";

type Period = "week" | "month" | "quarter" | "custom";
interface Analytics {
  kpis: { totalSpent: number; count: number; avgPerDay: number; topCategory: { key: string; amount: number } | null };
  categories: { id: string; name: string; colorToken: string; amount: number }[];
  accounts: { accountId: string; name: string; amount: number }[];
  daily: { date: string; amount: number }[];
  recurring: { merchant: string; amount: number; count: number }[];
  budgets: { id: string; name: string; colorToken: string; limit: number; actual: number }[];
}

const cssVar = (t: string) => (typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(`--c-${t}`).trim() || "#888" : "#888");

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); });
  const [customTo, setCustomTo] = useState(todayStr);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState(false);
  const [prevPeriod, setPrevPeriod] = useState(period);
  const [editingBudgets, setEditingBudgets] = useState(false);

  // Clear stale data as soon as the period changes, during render (React's documented
  // pattern), so the effect below only ever does the actual fetch side-effect.
  if (period !== prevPeriod) {
    setPrevPeriod(period);
    setData(null);
    setError(false);
  }

  const rangeInvalid = period === "custom" && (!customFrom || !customTo || customFrom > customTo);

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    setError(false);
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom") { params.set("from", customFrom); params.set("to", customTo); }
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) throw new Error("load failed");
      setData(await res.json());
    } catch {
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, period === "custom" ? customFrom : null, period === "custom" ? customTo : null]);

  useEffect(() => { const t = setTimeout(load, period === "custom" ? 400 : 0); return () => clearTimeout(t); }, [load, period]);

  async function exportPdf() {
    if (!data) return;
    const { jsPDF } = (await import("jspdf")) as any;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("Spending report", 14, 20);
    doc.setFontSize(11); doc.setTextColor(120);
    doc.text(`Period: ${period}  ·  Total: INR ${data.kpis.totalSpent.toLocaleString("en-IN")}`, 14, 30);
    let y = 44;
    doc.setTextColor(20); doc.setFontSize(13); doc.text("By category", 14, y); y += 8;
    doc.setFontSize(11);
    data.categories.forEach((c) => { doc.text(`${c.name}`, 16, y); doc.text(`INR ${c.amount.toLocaleString("en-IN")}`, 150, y); y += 7; });
    y += 6; doc.setFontSize(13); doc.text("Budgets", 14, y); y += 8; doc.setFontSize(11);
    data.budgets.forEach((b) => { doc.text(b.name, 16, y); doc.text(`${b.actual.toLocaleString("en-IN")} / ${b.limit.toLocaleString("en-IN")}`, 150, y); y += 7; });
    doc.save(`spending-${period}.pdf`);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Analytics</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "inline-flex", background: "var(--surface-2)", borderRadius: 10, padding: 3 }}>
            {(["week", "month", "quarter", "custom"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} style={{ border: "none", background: p === period ? "var(--surface-1)" : "transparent", color: p === period ? "var(--ink)" : "var(--ink-muted)", fontWeight: p === period ? 600 : 500, fontSize: 13, padding: "6px 14px", borderRadius: 7, cursor: "pointer", boxShadow: p === period ? "var(--shadow-e1)" : "none", textTransform: "capitalize", fontFamily: "inherit" }}>{p}</button>
            ))}
          </div>
          <button onClick={exportPdf} style={{ fontSize: 13, color: "var(--ink-muted)", border: "1px solid var(--hairline-strong)", padding: "7px 12px", borderRadius: 9, background: "var(--surface-1)", cursor: "pointer", fontFamily: "inherit" }}>Export PDF</button>
        </div>
      </div>

      {period === "custom" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
          <input type="date" value={customFrom} max={customTo || todayStr()} onChange={(e) => setCustomFrom(e.target.value)}
            style={{ fontSize: 13, padding: "7px 10px", borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "var(--surface-1)", color: "var(--ink)", fontFamily: "inherit" }} />
          <span style={{ color: "var(--ink-subtle)", fontSize: 13 }}>to</span>
          <input type="date" value={customTo} min={customFrom} max={todayStr()} onChange={(e) => setCustomTo(e.target.value)}
            style={{ fontSize: 13, padding: "7px 10px", borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "var(--surface-1)", color: "var(--ink)", fontFamily: "inherit" }} />
          {rangeInvalid && <span style={{ fontSize: 12.5, color: "var(--neg)" }}>Pick a valid range (from ≤ to).</span>}
        </div>
      )}

      {error && <Card style={{ padding: 20, color: "var(--warn)", background: "var(--warn-tint)", border: "none" }}>Couldn&apos;t load analytics. <button onClick={load} style={{ textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer" }}>Retry</button></Card>}

      {/* KPI cards (Stripe pattern) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <Kpi label="Total spent" value={data ? formatINR(data.kpis.totalSpent) : null} />
        <Kpi label="Avg / day" value={data ? formatINR(data.kpis.avgPerDay) : null} />
        <Kpi label="Transactions" value={data ? String(data.kpis.count) : null} />
        <Kpi label="Top category" value={data ? (data.kpis.topCategory ? formatINR(data.kpis.topCategory.amount) : "—") : null} sub={data?.kpis.topCategory?.key} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        {/* Category bars */}
        <Card style={{ padding: 18 }}>
          <Overline style={{ marginBottom: 14 }}>By category</Overline>
          {!data ? <Skeleton h={180} /> : data.categories.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={Math.max(160, data.categories.length * 34)}>
              <BarChart layout="vertical" data={data.categories} margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tip} formatter={(v: any) => formatINR(Number(v))} />
                <Bar dataKey="amount" radius={[0, 5, 5, 0]} barSize={16}>
                  {data.categories.map((c) => <Cell key={c.id} fill={cssVar(c.colorToken)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Trend line */}
        <Card style={{ padding: 18 }}>
          <Overline style={{ marginBottom: 14 }}>Daily trend</Overline>
          {!data ? <Skeleton h={180} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.daily} margin={{ left: 4, right: 8, top: 6 }}>
                <CartesianGrid stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ink-subtle)" }} tickFormatter={(d) => new Date(d).getDate().toString()} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink-subtle)" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tip} formatter={(v: any) => formatINR(Number(v))} labelFormatter={(l: any) => new Date(l).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} />
                <Line type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Calendar heatmap (Zerodha Console pattern) */}
      <Card style={{ padding: 18, marginTop: 16 }}>
        <Overline style={{ marginBottom: 14 }}>Spending calendar</Overline>
        {!data ? <Skeleton h={120} /> : <Heatmap data={data.daily} />}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginTop: 16 }}>
        {/* Budgets */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Overline style={{ marginBottom: 0 }}>Budgets vs actual</Overline>
            <button onClick={() => setEditingBudgets(true)} style={editBtn}>Edit</button>
          </div>
          {!data ? <Skeleton h={160} /> : data.budgets.length === 0 ? (
            <div style={{ padding: "10px 0" }}>
              <div style={{ fontSize: 13, color: "var(--ink-subtle)", marginBottom: 10 }}>No budgets set yet.</div>
              <button onClick={() => setEditingBudgets(true)} style={{ ...editBtn, padding: "8px 14px" }}>Set a budget</button>
            </div>
          ) : data.budgets.map((b) => {
            const pct = Math.min(100, (b.actual / b.limit) * 100);
            const over = b.actual > b.limit;
            return (
              <div key={b.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>{b.name !== "Overall" && <Dot token={b.colorToken} size={8} />}{b.name}</span>
                  <span className="num" style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{formatINR(b.actual)} / {formatINR(b.limit)}</span>
                </div>
                <div style={{ height: 7, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                  <span style={{ width: `${pct}%`, background: b.name === "Overall" ? "var(--accent)" : cssVar(b.colorToken), borderRadius: 999 }} />
                  {over && <span style={{ width: "6%", background: "var(--ink-subtle)", opacity: 0.5 }} />}
                </div>
                <div className="num" style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 5 }}>{over ? `${formatINR(b.actual - b.limit)} over — review` : `${formatINR(b.limit - b.actual)} left`}</div>
              </div>
            );
          })}
        </Card>

        {/* Accounts + insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 18 }}>
            <Overline style={{ marginBottom: 14 }}>By account</Overline>
            {!data ? <Skeleton h={100} /> : data.accounts.map((a) => (
              <div key={a.accountId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--hairline)", fontSize: 13.5 }}>
                <span>{a.name}</span><span className="num" style={{ fontWeight: 600 }}>{formatINR(a.amount)}</span>
              </div>
            ))}
          </Card>
          {data && data.recurring.length > 0 && (
            <Card style={{ padding: 18 }}>
              <Overline style={{ marginBottom: 10 }}>Recurring detected</Overline>
              {data.recurring.map((r) => (
                <div key={r.merchant} style={{ fontSize: 14, marginBottom: 8 }}>
                  <b>{r.merchant}</b> <span style={{ color: "var(--ink-muted)" }}>· {formatINR(r.amount)} × {r.count}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {editingBudgets && <BudgetEditor onClose={() => setEditingBudgets(false)} onSaved={load} />}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <Card lift style={{ padding: 16 }}>
      <Overline style={{ fontSize: 10 }}>{label}</Overline>
      {value === null ? <Skeleton h={26} style={{ marginTop: 6 }} /> : <div className="num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 4 }}>{value}</div>}
      {sub && <div style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 2, textTransform: "capitalize" }}>{sub}</div>}
    </Card>
  );
}
function Empty() {
  return <div style={{ height: 160, display: "grid", placeItems: "center", color: "var(--ink-subtle)", fontSize: 13, textAlign: "center" }}>No spending this period yet.</div>;
}
const tip: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--hairline-strong)", borderRadius: 8, fontSize: 12, color: "var(--ink)" } as any;
const editBtn: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" };
