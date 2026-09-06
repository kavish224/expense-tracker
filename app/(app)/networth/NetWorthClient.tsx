"use client";
import React, { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, Overline, Glyph, Button, formatINR } from "@/components/ui";
import { useShell } from "@/components/AppShell";

interface Entry { accountId: string; name: string; type: string; colorToken: string; icon: string; contribution: number }
interface NetWorthData {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assets: Entry[];
  liabilities: Entry[];
  series: { date: string; netWorth: number }[];
}

const tip: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--hairline-strong)", borderRadius: 8, fontSize: 12, color: "var(--ink)" } as any;

export function NetWorthClient({ initial }: { initial: NetWorthData }) {
  const [data, setData] = useState(initial);
  const [snapshotting, setSnapshotting] = useState(false);
  const { toast } = useShell();

  async function snapshot() {
    if (snapshotting) return;
    setSnapshotting(true);
    try {
      const res = await fetch("/api/networth/snapshot", { method: "POST" });
      if (!res.ok) throw new Error("snapshot failed");
      const res2 = await fetch("/api/networth");
      if (res2.ok) setData(await res2.json());
      toast("Net worth snapshot saved");
    } catch {
      toast("Couldn't save snapshot — check your connection and try again.");
    } finally {
      setSnapshotting(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Net worth</h1>
        <Button onClick={snapshot} size="sm" disabled={snapshotting}>{snapshotting ? "Saving…" : "Snapshot now"}</Button>
      </div>

      <Card lift style={{ padding: 22, marginBottom: 16 }}>
        <Overline style={{ fontSize: 10 }}>Net worth</Overline>
        <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", margin: "6px 0 14px", color: data.netWorth < 0 ? "var(--neg)" : "var(--ink)" }}>
          {formatINR(data.netWorth)}
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
          <div><span style={{ color: "var(--ink-subtle)" }}>Assets </span><span className="num" style={{ fontWeight: 600, color: "var(--pos)" }}>{formatINR(data.totalAssets)}</span></div>
          <div><span style={{ color: "var(--ink-subtle)" }}>Liabilities </span><span className="num" style={{ fontWeight: 600, color: "var(--neg)" }}>{formatINR(data.totalLiabilities)}</span></div>
        </div>
      </Card>

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <Overline style={{ marginBottom: 14 }}>Trend</Overline>
        {data.series.length < 2 ? (
          <div style={{ height: 140, display: "grid", placeItems: "center", color: "var(--ink-subtle)", fontSize: 13, textAlign: "center", padding: "0 20px" }}>
            Snapshot your net worth a few times (weekly or monthly) to see a trend here.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.series} margin={{ left: 4, right: 8, top: 6 }}>
              <CartesianGrid stroke="var(--hairline)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ink-subtle)" }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: "var(--ink-subtle)" }} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tip} formatter={(v: any) => formatINR(Number(v))} labelFormatter={(l: any) => new Date(l).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
              <Line type="monotone" dataKey="netWorth" stroke="var(--accent)" strokeWidth={2} dot={data.series.length <= 20} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        <AccountGroup title="Assets" entries={data.assets} empty="No asset accounts yet." />
        <AccountGroup title="Liabilities" entries={data.liabilities} empty="No liabilities — nothing owed." />
      </div>

      <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--ink-subtle)" }}>
        Bank/cash/credit card balances are computed live from your transactions. Investments, loans, and other assets are tracked manually — update them from the <a href="/accounts" style={{ color: "var(--accent)" }}>Accounts</a> page.
      </div>
    </div>
  );
}

function AccountGroup({ title, entries, empty }: { title: string; entries: Entry[]; empty: string }) {
  return (
    <Card style={{ padding: 18 }}>
      <Overline style={{ marginBottom: 14 }}>{title}</Overline>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "6px 0" }}>{empty}</div>
      ) : entries.map((e, i) => (
        <div key={e.accountId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < entries.length - 1 ? "1px solid var(--hairline)" : "none" }}>
          <Glyph token={e.colorToken} icon={e.icon} size={32} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
          <span className="num" style={{ fontSize: 13.5, fontWeight: 600 }}>{formatINR(Math.abs(e.contribution))}</span>
        </div>
      ))}
    </Card>
  );
}
