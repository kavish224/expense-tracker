"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Card, formatINR, Skeleton } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/primitives/tabs";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { useShell } from "@/components/AppShell";

interface CandidateTxn {
  id: string;
  accountId: string;
  accountName: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  txnDatetime: string;
  merchantName: string | null;
  rawNarration: string | null;
}
interface Suggestion {
  debit: CandidateTxn;
  credit: CandidateTxn;
  daysApart: number;
  confidence: "high" | "medium";
}
interface Settlement {
  id: string;
  amount: number;
  txnDatetime: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  note: string | null;
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });

export function SettlementsClient() {
  const { toast } = useShell();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tab, setTab] = useState("suggested");

  const loadSuggestions = useCallback(async () => {
    setSuggestions(null);
    const res = await fetch("/api/transfers/suggestions");
    const data = await res.json().catch(() => ({ suggestions: [] }));
    setSuggestions(data.suggestions || []);
  }, []);

  const loadSettlements = useCallback(async () => {
    setSettlements(null);
    const res = await fetch("/api/settlements");
    const data = await res.json().catch(() => ({ settlements: [] }));
    setSettlements(data.settlements || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadSuggestions();
      loadSettlements();
    }, 0);
    return () => clearTimeout(t);
  }, [loadSuggestions, loadSettlements]);

  async function confirm(s: Suggestion) {
    const key = `${s.debit.id}:${s.credit.id}`;
    setBusyKey(key);
    try {
      const res = await fetch("/api/transfers/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debitId: s.debit.id, creditId: s.credit.id }),
      });
      if (!res.ok) throw new Error();
      toast(`Linked as a transfer between ${s.debit.accountName} and ${s.credit.accountName}`);
      await Promise.all([loadSuggestions(), loadSettlements()]);
    } catch {
      toast("Couldn't confirm this transfer — try again.");
    } finally {
      setBusyKey(null);
    }
  }

  async function dismiss(s: Suggestion) {
    const key = `${s.debit.id}:${s.credit.id}`;
    setBusyKey(key);
    try {
      const res = await fetch("/api/transfers/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debitId: s.debit.id, creditId: s.credit.id }),
      });
      if (!res.ok) throw new Error();
      setSuggestions((prev) => (prev ?? []).filter((x) => x !== s));
    } catch {
      toast("Couldn't dismiss this suggestion — try again.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Settlements</h1>
        <p className="text-[13px] text-ink-muted">Money moving between your own accounts — not real spend.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="suggested">
            Suggested{suggestions && suggestions.length > 0 ? ` (${suggestions.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
        </TabsList>

        <TabsContent value="suggested">
          {!suggestions && (
            <Card style={{ padding: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} h={48} style={{ marginBottom: 10 }} />
              ))}
            </Card>
          )}
          {suggestions && suggestions.length === 0 && (
            <p className="text-ink-subtle p-6 text-center">
              No unlinked transfer pairs found. Import more statements or check back later.
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            {suggestions?.map((s) => {
              const key = `${s.debit.id}:${s.credit.id}`;
              const busy = busyKey === key;
              return (
                <Card key={key} style={{ padding: "14px 16px" }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[14px]">
                          {s.debit.accountName} <span className="text-ink-subtle">→</span> {s.credit.accountName}
                        </span>
                        <span className="text-[12.5px] text-ink-muted">
                          {dayLabel(s.debit.txnDatetime)}
                          {s.daysApart > 0 ? ` · ${s.daysApart.toFixed(0)}d apart` : " · same day"}
                          {" · "}
                          {s.debit.merchantName || s.debit.rawNarration || "—"}
                        </span>
                      </div>
                      <Badge variant={s.confidence === "high" ? "positive" : "warning"}>
                        {s.confidence === "high" ? "Likely match" : "Possible match"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[15px] mr-2">{formatINR(s.debit.amount)}</span>
                      <Button variant="secondary" size="sm" disabled={busy} onClick={() => dismiss(s)}>
                        Not a transfer
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => confirm(s)}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="confirmed">
          {!settlements && (
            <Card style={{ padding: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} h={40} style={{ marginBottom: 10 }} />
              ))}
            </Card>
          )}
          {settlements && settlements.length === 0 && (
            <p className="text-ink-subtle p-6 text-center">No confirmed settlements yet.</p>
          )}
          <div className="flex flex-col gap-2">
            {settlements?.map((s) => (
              <Card key={s.id} style={{ padding: "12px 16px" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col">
                    <span className="font-semibold text-[13.5px]">
                      {s.fromAccountName} <span className="text-ink-subtle">→</span> {s.toAccountName}
                    </span>
                    <span className="text-[12px] text-ink-muted">
                      {dayLabel(s.txnDatetime)}
                      {s.note ? ` · ${s.note}` : ""}
                    </span>
                  </div>
                  <span className="font-semibold text-[14px]">{formatINR(s.amount)}</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
