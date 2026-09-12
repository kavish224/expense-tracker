"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ShellAccount } from "@/lib/user";
import { Card, Glyph, formatINR, Skeleton } from "@/components/ui";
import { Donut, type DonutSlice } from "@/components/charts/Donut";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/primitives/table";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Input, Label } from "@/components/primitives/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/primitives/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/primitives/toggle-group";
import { useShell } from "@/components/AppShell";

interface InvestmentAccount {
  id: string;
  name: string;
  institution: string | null;
  colorToken: string;
  icon: string;
}
interface Summary {
  accountId: string;
  name: string;
  institution: string | null;
  colorToken: string;
  icon: string;
  invested: number;
  withdrawn: number;
  netInvested: number;
  currentValue: number;
  gainLoss: number;
  gainLossPct: number | null;
}
interface Flow {
  id: string;
  accountId: string;
  accountName: string;
  fundingAccountId: string;
  fundingAccountName: string;
  direction: "CONTRIBUTION" | "WITHDRAWAL";
  amount: number;
  txnDatetime: string;
  note: string | null;
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
const todayStr = () => new Date().toISOString().slice(0, 10);

export function InvestmentsClient({
  fundingAccounts,
  investmentAccounts,
}: {
  fundingAccounts: ShellAccount[];
  investmentAccounts: InvestmentAccount[];
}) {
  const { toast } = useShell();
  const [summaries, setSummaries] = useState<Summary[] | null>(null);
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    investmentAccountId: investmentAccounts[0]?.id ?? "",
    fundingAccountId: fundingAccounts[0]?.id ?? "",
    direction: "CONTRIBUTION" as "CONTRIBUTION" | "WITHDRAWAL",
    amount: "",
    date: todayStr(),
    note: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/investments");
    const data = await res.json().catch(() => ({ summaries: [], flows: [] }));
    setSummaries(data.summaries || []);
    setFlows(data.flows || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save() {
    if (!form.investmentAccountId || !form.fundingAccountId || !form.amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/investments/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investmentAccountId: form.investmentAccountId,
          fundingAccountId: form.fundingAccountId,
          direction: form.direction,
          amount: Number(form.amount),
          date: form.date,
          note: form.note || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      setForm((f) => ({ ...f, amount: "", note: "" }));
      toast(form.direction === "CONTRIBUTION" ? "Contribution recorded" : "Withdrawal recorded");
      await load();
    } catch {
      toast("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const totalCurrentValue = (summaries || []).reduce((a, s) => a + s.currentValue, 0);
  const totalNetInvested = (summaries || []).reduce((a, s) => a + s.netInvested, 0);
  const totalGainLoss = totalCurrentValue - totalNetInvested;
  const donutData: DonutSlice[] = (summaries || [])
    .filter((s) => s.currentValue > 0)
    .map((s) => ({ id: s.accountId, name: s.name, amount: s.currentValue, colorToken: s.colorToken }));

  if (investmentAccounts.length === 0) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 18px 40px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Investments</h1>
        <Card style={{ padding: 32, textAlign: "center" }}>
          <p className="text-ink-muted mb-3">No investment platforms yet.</p>
          <Link href="/accounts">
            <Button>Add a platform under Accounts</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Investments</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Record contribution / withdrawal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record investment flow</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <ToggleGroup
                type="single"
                value={form.direction}
                onValueChange={(v) => v && setForm((f) => ({ ...f, direction: v as "CONTRIBUTION" | "WITHDRAWAL" }))}
              >
                <ToggleGroupItem value="CONTRIBUTION">Money in</ToggleGroupItem>
                <ToggleGroupItem value="WITHDRAWAL">Money out</ToggleGroupItem>
              </ToggleGroup>

              <div>
                <Label>Platform</Label>
                <select
                  value={form.investmentAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, investmentAccountId: e.target.value }))}
                  className="h-9 w-full rounded-[10px] border border-hairline-strong bg-surface-2 px-3 text-[14px] text-ink outline-none"
                >
                  {investmentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>{form.direction === "CONTRIBUTION" ? "From account" : "To account"}</Label>
                <select
                  value={form.fundingAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, fundingAccountId: e.target.value }))}
                  className="h-9 w-full rounded-[10px] border border-hairline-strong bg-surface-2 px-3 text-[14px] text-ink outline-none"
                >
                  {fundingAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label>Note (optional)</Label>
                <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. SIP, monthly top-up" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving || !form.amount} onClick={save}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!summaries && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <Skeleton h={140} />
        </Card>
      )}

      {summaries && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card style={{ padding: 20 }}>
              <div className="text-[12px] text-ink-muted mb-1">Net invested</div>
              <div className="text-[22px] font-semibold">{formatINR(totalNetInvested)}</div>
            </Card>
            <Card style={{ padding: 20 }}>
              <div className="text-[12px] text-ink-muted mb-1">Current value</div>
              <div className="text-[22px] font-semibold">{formatINR(totalCurrentValue)}</div>
            </Card>
            <Card style={{ padding: 20 }}>
              <div className="text-[12px] text-ink-muted mb-1">Gain / loss</div>
              <div className={`text-[22px] font-semibold ${totalGainLoss >= 0 ? "text-pos" : "text-neg"}`}>
                {formatINR(totalGainLoss, false, true)}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Donut data={donutData} centerLabel="Current value" centerValue={formatINR(totalCurrentValue)} />
            </Card>
            <div className="flex flex-col gap-2.5">
              {summaries.map((s) => (
                <Card key={s.accountId} style={{ padding: "14px 16px" }}>
                  <div className="flex items-center gap-3 justify-between flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <Glyph token={s.colorToken} icon={s.icon} size={32} />
                      <div className="flex flex-col">
                        <span className="font-semibold text-[14px]">{s.name}</span>
                        <span className="text-[12px] text-ink-muted">
                          Invested {formatINR(s.invested)}
                          {s.withdrawn > 0 ? ` · Withdrawn ${formatINR(s.withdrawn)}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[15px]">{formatINR(s.currentValue)}</div>
                      {s.gainLossPct != null && (
                        <Badge variant={s.gainLoss >= 0 ? "positive" : "negative"}>
                          {s.gainLoss >= 0 ? "+" : ""}
                          {s.gainLossPct.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <Card style={{ overflow: "hidden" }}>
        <div className="px-3.5 py-2.5 border-b border-hairline font-semibold text-[13px]">History</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!flows &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton h={16} />
                  </TableCell>
                </TableRow>
              ))}
            {flows && flows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-ink-subtle py-8">
                  No contributions or withdrawals recorded yet.
                </TableCell>
              </TableRow>
            )}
            {flows?.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap text-ink-muted">{dayLabel(f.txnDatetime)}</TableCell>
                <TableCell>{f.accountName}</TableCell>
                <TableCell className="text-ink-muted">{f.fundingAccountName}</TableCell>
                <TableCell>
                  <Badge variant={f.direction === "CONTRIBUTION" ? "positive" : "neutral"}>
                    {f.direction === "CONTRIBUTION" ? "Money in" : "Money out"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap">{formatINR(f.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
