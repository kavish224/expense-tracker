"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, formatINR, Skeleton } from "@/components/ui";
import { Donut, type DonutSlice } from "@/components/charts/Donut";
import { BarList, type BarListItem } from "@/components/charts/BarList";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/primitives/table";
import { Badge } from "@/components/primitives/badge";
import { Input } from "@/components/primitives/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/primitives/toggle-group";

interface Txn {
  id: string;
  amount: number;
  direction: string;
  kind: string;
  txnDatetime: string;
  merchantName?: string;
  account: { id: string; name: string; colorToken: string } | null;
  category: { id: string; name: string; colorToken: string; icon: string } | null;
}

type Period = "month" | "last-month" | "all";

function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date();
  if (period === "all") return {};
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10) };
  }
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export function ExpensesClient() {
  const [period, setPeriod] = useState<Period>("month");
  const [q, setQ] = useState("");
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setTxns(null);
    setError(false);
    const { from, to } = periodRange(period);
    const params = new URLSearchParams({ kind: "EXPENSE", take: "500" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTxns(data.transactions || []);
    } catch {
      setTxns([]);
      setError(true);
    }
  }, [period]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const spend = useMemo(() => (txns || []).filter((t) => t.direction === "DEBIT"), [txns]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; colorToken: string; amount: number }>();
    for (const t of spend) {
      const key = t.category?.id || "uncategorized";
      const cur = map.get(key) || { name: t.category?.name || "Uncategorized", colorToken: t.category?.colorToken || "misc", amount: 0 };
      cur.amount += t.amount;
      map.set(key, cur);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount);
  }, [spend]);

  const donutData: DonutSlice[] = byCategory.map((c) => ({ id: c.id, name: c.name, amount: c.amount, colorToken: c.colorToken }));
  const barData: BarListItem[] = byCategory.map((c) => ({ key: c.id, name: c.name, value: c.amount, colorToken: c.colorToken }));

  const filteredList = useMemo(() => {
    let list = spend;
    if (selectedCategory) list = list.filter((t) => (t.category?.id || "uncategorized") === selectedCategory);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((t) => t.merchantName?.toLowerCase().includes(needle) || String(t.amount).includes(needle));
    }
    return list;
  }, [spend, selectedCategory, q]);

  const total = spend.reduce((a, t) => a + t.amount, 0);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Expenses</h1>
        <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
          <ToggleGroupItem value="month">This month</ToggleGroupItem>
          <ToggleGroupItem value="last-month">Last month</ToggleGroupItem>
          <ToggleGroupItem value="all">All time</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-[13px] text-ink-muted mb-4">
        Real spend only — settlements and transfers between your own accounts are excluded.
      </p>

      {!txns && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <Skeleton h={180} />
        </Card>
      )}

      {txns && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Donut
              data={donutData}
              centerLabel="Total spent"
              centerValue={formatINR(total)}
              selectedId={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </Card>
          <Card style={{ padding: 20 }}>
            <BarList data={barData} valueFormatter={(v) => formatINR(v)} onSelect={setSelectedCategory} selectedKey={selectedCategory} />
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant or amount…" className="max-w-xs" />
        {selectedCategory && (
          <Badge variant="accent" className="cursor-pointer" onClick={() => setSelectedCategory(null)}>
            Filtered — click to clear ×
          </Badge>
        )}
        <span className="text-[13px] text-ink-muted ml-auto">{filteredList.length} transactions</span>
      </div>

      <Card style={{ overflow: "hidden" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!txns &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton h={16} />
                  </TableCell>
                </TableRow>
              ))}
            {txns && error && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-ink-subtle py-8">
                  Couldn&apos;t load expenses.
                </TableCell>
              </TableRow>
            )}
            {txns && !error && filteredList.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-ink-subtle py-8">
                  No expenses in this period.
                </TableCell>
              </TableRow>
            )}
            {filteredList.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap text-ink-muted">{dayLabel(t.txnDatetime)}</TableCell>
                <TableCell>{t.merchantName || "—"}</TableCell>
                <TableCell>
                  {t.category ? <Badge variant="neutral">{t.category.name}</Badge> : <Badge variant="warning">Uncategorized</Badge>}
                </TableCell>
                <TableCell className="text-ink-muted">{t.account?.name}</TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap">{formatINR(t.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
