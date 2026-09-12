"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { Card, Overline, Dot, formatINR } from "@/components/ui";
import { Heatmap } from "@/components/Heatmap";
import { BudgetEditor } from "@/components/BudgetEditor";
import { Donut, type DonutSlice } from "@/components/charts/Donut";
import { BarList } from "@/components/charts/BarList";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { AreaChartSkeleton, DonutSkeleton, BarListSkeleton } from "@/components/charts/ChartSkeleton";
import { axisTick, gridStroke, formatCompactINR, pctDelta } from "@/lib/charts/theme";
import { Progress } from "@/components/primitives/progress";
import { Button } from "@/components/primitives/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/primitives/toggle-group";

type Period = "week" | "month" | "quarter" | "custom";
interface Kpis { totalSpent: number; count: number; avgPerDay: number; topCategory: { key: string; amount: number } | null }
interface Analytics {
  kpis: Kpis;
  previousKpis: Kpis;
  categories: { id: string; name: string; colorToken: string; amount: number; budgetLimit?: number }[];
  merchants: { name: string; colorToken: string; amount: number; count: number }[];
  accounts: { accountId: string; name: string; amount: number }[];
  daily: { date: string; amount: number }[];
  dailyCategories: { date: string; categories: Record<string, number> }[];
  recurring: { merchant: string; amount: number; count: number }[];
  budgets: { id: string; name: string; colorToken: string; limit: number; actual: number }[];
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); });
  const [customTo, setCustomTo] = useState(todayStr);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState(false);
  const [prevPeriod, setPrevPeriod] = useState(period);
  const [editingBudgets, setEditingBudgets] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Clear stale data as soon as the period changes, during render (React's documented
  // pattern), so the effect below only ever does the actual fetch side-effect.
  if (period !== prevPeriod) {
    setPrevPeriod(period);
    setData(null);
    setError(false);
    setSelectedDate(null);
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

  // Category composition for the donut: whole-period by default, or the single
  // selected day's breakdown when a trend-chart point / heatmap cell is clicked.
  const categoryDonutData: (DonutSlice & { budgetLimit?: number })[] = useMemo(() => {
    if (!data) return [];
    if (selectedDate) {
      const day = data.dailyCategories.find((d) => d.date === selectedDate);
      if (!day) return [];
      return Object.entries(day.categories)
        .map(([id, amount]) => {
          const cat = data.categories.find((c) => c.id === id);
          return { id, name: cat?.name ?? "Uncategorized", amount, colorToken: cat?.colorToken ?? "misc" };
        })
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount);
    }
    // Budget progress only makes sense against the whole period's spend, not a
    // single drilled-down day — omitted there rather than showing a bar against
    // a monthly limit that one day's amount would never meaningfully fill.
    return data.categories.map((c) => ({ id: c.id, name: c.name, amount: c.amount, colorToken: c.colorToken, budgetLimit: c.budgetLimit }));
  }, [data, selectedDate]);
  const categoryDonutTotal = categoryDonutData.reduce((s, d) => s + d.amount, 0);

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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as Period)}
            className="inline-flex gap-0.5 rounded-[10px] bg-surface-2 p-[3px]"
          >
            {(["week", "month", "quarter", "custom"] as Period[]).map((p) => (
              <ToggleGroupItem
                key={p}
                value={p}
                className="rounded-[7px] border-none bg-transparent px-3.5 py-1.5 text-[13px] font-medium capitalize text-ink-muted data-[state=on]:bg-surface-1 data-[state=on]:font-semibold data-[state=on]:text-ink data-[state=on]:shadow-[var(--shadow-e1)]"
              >
                {p}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button variant="secondary" size="sm" onClick={exportPdf}>Export PDF</Button>
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

      {/* Hero: one number that answers "how much", plus period-over-period context */}
      <Card lift style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
          <div>
            <Overline>Total spent</Overline>
            {!data ? (
              <div className="skeleton" style={{ width: 160, height: 36, marginTop: 6, borderRadius: 8 }} />
            ) : (
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
                <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>{formatINR(data.kpis.totalSpent)}</div>
                <Delta pct={pctDelta(data.kpis.totalSpent, data.previousKpis.totalSpent)} tone="invert" />
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 2 }}>vs previous {period === "custom" ? "period" : period}</div>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <KpiChip label="Avg / day" value={data ? formatINR(data.kpis.avgPerDay) : null} pct={data ? pctDelta(data.kpis.avgPerDay, data.previousKpis.avgPerDay) : undefined} tone="invert" />
            <KpiChip label="Transactions" value={data ? String(data.kpis.count) : null} pct={data ? pctDelta(data.kpis.count, data.previousKpis.count) : undefined} />
            <KpiChip label="Top category" value={data ? (data.kpis.topCategory ? formatINR(data.kpis.topCategory.amount) : "—") : null} sub={data?.kpis.topCategory?.key} />
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        {/* Category composition */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Overline style={{ marginBottom: 0 }}>By category</Overline>
            {selectedDate && (
              <Button variant="secondary" size="sm" className="h-auto rounded-full px-2.5 py-1 text-[11.5px]" onClick={() => setSelectedDate(null)}>{fmtDay(selectedDate)} ✕</Button>
            )}
          </div>
          {!data ? <DonutSkeleton /> : categoryDonutData.length === 0 ? <Empty /> : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Donut data={categoryDonutData} centerLabel={selectedDate ? fmtDay(selectedDate) : "Total"} centerValue={formatINR(categoryDonutTotal)} />
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                {categoryDonutData.map((c) => {
                  const pct = c.budgetLimit ? Math.min(100, (c.amount / c.budgetLimit) * 100) : null;
                  const over = c.budgetLimit != null && c.amount > c.budgetLimit;
                  const tone = over ? "neg" : pct !== null && pct >= 80 ? "warn" : "pos";
                  return (
                    <div key={c.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
                        <Dot token={c.colorToken} size={8} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                        <span className="num" style={{ fontWeight: 600 }}>
                          {formatINR(c.amount)}{c.budgetLimit != null && <span style={{ color: "var(--ink-subtle)", fontWeight: 400 }}> / {formatINR(c.budgetLimit)}</span>}
                        </span>
                      </div>
                      {pct !== null && <Progress value={pct} tone={tone} className="mt-[5px] ml-[17px] w-auto" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Trend — clickable to cross-filter category composition to a single day */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Overline style={{ marginBottom: 0 }}>Daily trend</Overline>
            {selectedDate && (
              <Button variant="secondary" size="sm" className="h-auto rounded-full px-2.5 py-1 text-[11.5px]" onClick={() => setSelectedDate(null)}>{fmtDay(selectedDate)} ✕</Button>
            )}
          </div>
          {!data ? <AreaChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={data.daily}
                margin={{ left: 4, right: 8, top: 6 }}
                onClick={(p: any) => {
                  const d = p?.activeLabel as string | undefined;
                  if (!d) return;
                  setSelectedDate((prev) => (prev === d ? null : d));
                }}
                style={{ cursor: "pointer" }}
              >
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} tickFormatter={(d) => new Date(d).getDate().toString()} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={formatCompactINR} />
                <ReferenceLine y={data.kpis.avgPerDay} stroke="var(--ink-subtle)" strokeDasharray="4 4" strokeOpacity={0.6} />
                {selectedDate && <ReferenceLine x={selectedDate} stroke="var(--ink)" strokeDasharray="3 3" />}
                <Tooltip
                  content={(p: any) => (
                    <ChartTooltip {...p} formatter={(v: number) => formatINR(v)} labelFormatter={(l) => fmtDay(String(l))} />
                  )}
                />
                <Area type="monotone" dataKey="amount" name="Spent" stroke="var(--accent)" strokeWidth={2.5} fill="url(#trendGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Calendar heatmap — clicking a day drives the same cross-filter as the trend chart */}
      <Card style={{ padding: 18, marginTop: 16 }}>
        <Overline style={{ marginBottom: 14 }}>Spending calendar</Overline>
        {!data ? <AreaChartSkeleton height={120} /> : <Heatmap data={data.daily} selectedDate={selectedDate} onSelect={setSelectedDate} />}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginTop: 16 }}>
        {/* Budgets */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Overline style={{ marginBottom: 0 }}>Budgets vs actual</Overline>
            <Button variant="ghost" size="sm" className="h-auto rounded-full bg-accent-tint px-3 py-1 text-[12px] text-accent" onClick={() => setEditingBudgets(true)}>Edit</Button>
          </div>
          {!data ? <BarListSkeleton /> : data.budgets.length === 0 ? (
            <div style={{ padding: "10px 0" }}>
              <div style={{ fontSize: 13, color: "var(--ink-subtle)", marginBottom: 10 }}>No budgets set yet.</div>
              <Button variant="ghost" size="sm" className="h-auto rounded-full bg-accent-tint px-3.5 py-2 text-[12px] text-accent" onClick={() => setEditingBudgets(true)}>Set a budget</Button>
            </div>
          ) : data.budgets.map((b) => {
            const pct = Math.min(100, (b.actual / b.limit) * 100);
            const over = b.actual > b.limit;
            const tone = over ? "neg" : pct >= 80 ? "warn" : "pos";
            return (
              <div key={b.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>{b.name !== "Overall" && <Dot token={b.colorToken} size={8} />}{b.name}</span>
                  <span className="num" style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{formatINR(b.actual)} / {formatINR(b.limit)}</span>
                </div>
                <Progress value={pct} tone={tone} className="h-[7px]" />
                <div className="num" style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 5 }}>{over ? `${formatINR(b.actual - b.limit)} over — review` : `${formatINR(b.limit - b.actual)} left`}</div>
              </div>
            );
          })}
        </Card>

        {/* Accounts + insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 18 }}>
            <Overline style={{ marginBottom: 14 }}>Top merchants</Overline>
            {!data ? <BarListSkeleton /> : data.merchants.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "6px 0" }}>No spending this period yet.</div>
            ) : (
              <BarList
                data={data.merchants.map((m) => ({ key: m.name, name: m.name, value: m.amount, colorToken: m.colorToken, sub: `×${m.count}` }))}
                valueFormatter={formatINR}
              />
            )}
          </Card>
          <Card style={{ padding: 18 }}>
            <Overline style={{ marginBottom: 14 }}>By account</Overline>
            {!data ? (
              <BarListSkeleton rows={3} />
            ) : (
              <BarList data={data.accounts.map((a) => ({ key: a.accountId, name: a.name, value: a.amount }))} valueFormatter={formatINR} />
            )}
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

/** Percent-change badge. `tone` decides whether the color judges the change:
 * "invert" = lower is better (spend, avg/day), "neutral" = no judgement, just
 * report the direction (transaction count — more isn't inherently bad). */
function Delta({ pct, tone = "neutral" }: { pct: number | null | undefined; tone?: "invert" | "neutral" }) {
  if (pct === null || pct === undefined) return null;
  const up = pct > 0;
  const good = tone === "neutral" || pct === 0 ? null : !up;
  const color = good === null ? "var(--ink-subtle)" : good ? "var(--pos)" : "var(--neg)";
  const arrow = pct === 0 ? "" : up ? "▲" : "▼";
  return <span className="num" style={{ fontSize: 13, fontWeight: 600, color }}>{arrow} {Math.abs(pct).toFixed(0)}%</span>;
}

function KpiChip({ label, value, sub, pct, tone }: { label: string; value: string | null; sub?: string; pct?: number | null; tone?: "invert" | "neutral" }) {
  return (
    <div style={{ minWidth: 90 }}>
      <Overline style={{ fontSize: 10, marginBottom: 4 }}>{label}</Overline>
      {value === null ? <div className="skeleton" style={{ width: 64, height: 20, borderRadius: 6 }} /> : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{value}</span>
          <Delta pct={pct} tone={tone} />
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 2, textTransform: "capitalize" }}>{sub}</div>}
    </div>
  );
}

function Empty() {
  return <div style={{ height: 160, display: "grid", placeItems: "center", color: "var(--ink-subtle)", fontSize: 13, textAlign: "center" }}>No spending this period yet.</div>;
}
