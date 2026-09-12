"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { ShellAccount } from "@/lib/user";
import { Card, formatINR, Skeleton } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/primitives/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/primitives/table";
import { Badge } from "@/components/primitives/badge";
import { Input } from "@/components/primitives/input";

interface StatementTxn {
  id: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  txnDatetime: string;
  merchantName: string | null;
  rawNarration: string | null;
  categoryName: string | null;
  kind: string;
  source: string;
  runningBalance: number;
}

interface StatementData {
  account: { id: string; name: string; type: string; institution: string | null; identifierHint: string | null; openingBalance: number };
  transactions: StatementTxn[];
}

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });

export function StatementsClient({ accounts }: { accounts: ShellAccount[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [data, setData] = useState<StatementData | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setData(null);
      setError(false);
      fetch(`/api/statements?accountId=${accountId}`)
        .then((r) => {
          if (!r.ok) throw new Error("failed");
          return r.json();
        })
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [accountId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q.trim()) return data.transactions;
    const needle = q.trim().toLowerCase();
    return data.transactions.filter(
      (t) =>
        t.merchantName?.toLowerCase().includes(needle) ||
        t.rawNarration?.toLowerCase().includes(needle) ||
        String(t.amount).includes(needle)
    );
  }, [data, q]);

  const groups = useMemo(() => {
    const map = new Map<string, StatementTxn[]>();
    for (const t of filtered) {
      const key = monthLabel(t.txnDatetime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [filtered]);

  if (accounts.length === 0) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Statements</h1>
        <p style={{ color: "var(--ink-muted)" }}>No bank or card accounts yet — add one under Accounts first.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Statements</h1>
        <p className="text-[13px] text-ink-muted">
          Raw ledger, exactly as imported — no categorization, no filtering applied.
        </p>
      </div>

      <Tabs value={accountId} onValueChange={setAccountId}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {accounts.map((a) => (
            <TabsTrigger key={a.id} value={a.id}>
              {a.name}
              {a.identifierHint ? <span className="ml-1 text-ink-subtle">···{a.identifierHint}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {accounts.map((a) => (
          <TabsContent key={a.id} value={a.id}>
            {accountId === a.id && (
              <StatementBody data={data} error={error} q={q} setQ={setQ} groups={groups} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StatementBody({
  data,
  error,
  q,
  setQ,
  groups,
}: {
  data: StatementData | null;
  error: boolean;
  q: string;
  setQ: (v: string) => void;
  groups: [string, StatementTxn[]][];
}) {
  if (error) {
    return <p className="text-ink-subtle p-6 text-center">Couldn&apos;t load this statement.</p>;
  }
  if (!data) {
    return (
      <Card style={{ padding: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h={16} style={{ marginBottom: 10 }} />
        ))}
      </Card>
    );
  }

  const latest = data.transactions[0];

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search narration or amount…"
          className="max-w-xs"
        />
        <div className="text-[13px] text-ink-muted ml-auto">
          {data.transactions.length} entries
          {latest ? (
            <>
              {" "}
              · closing balance <strong className="text-ink">{formatINR(latest.runningBalance)}</strong>
            </>
          ) : null}
        </div>
      </div>

      {groups.length === 0 && <p className="text-ink-subtle p-6 text-center">No transactions in this statement yet.</p>}

      {groups.map(([month, rows]) => (
        <Card key={month} style={{ marginBottom: 16, overflow: "hidden" }}>
          <div className="px-3.5 py-2.5 border-b border-hairline flex items-center justify-between">
            <span className="font-semibold text-[13px]">{month}</span>
            <span className="text-[12px] text-ink-muted">{rows.length} entries</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-ink-muted">{dayLabel(t.txnDatetime)}</TableCell>
                  <TableCell className="max-w-[360px] truncate" title={t.rawNarration ?? undefined}>
                    {t.merchantName || t.rawNarration || "—"}
                  </TableCell>
                  <TableCell>
                    {t.kind === "TRANSFER" ? (
                      <Badge variant="accent">Transfer</Badge>
                    ) : t.categoryName ? (
                      <Badge variant="neutral">{t.categoryName}</Badge>
                    ) : (
                      <Badge variant="warning">Uncategorized</Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold whitespace-nowrap ${
                      t.direction === "CREDIT" ? "text-pos" : "text-ink"
                    }`}
                  >
                    {formatINR(t.amount, false, t.direction === "CREDIT")}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-ink-muted">
                    {formatINR(t.runningBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
