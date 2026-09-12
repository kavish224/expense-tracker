"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type Column, type RenderCellProps, type SortColumn } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { ShellAccount } from "@/lib/user";
import { formatINR } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/primitives/tabs";
import { Badge } from "@/components/primitives/badge";
import { Input } from "@/components/primitives/input";
import { Button } from "@/components/primitives/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/primitives/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/primitives/select";
import { Highlighter, Link2, Link2Off, Tag } from "lucide-react";

interface LinkableAccount {
  id: string;
  name: string;
  type: string;
}

interface StatementTxn {
  id: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  txnDatetime: string;
  merchantName: string | null;
  rawNarration: string | null;
  note: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColorToken: string | null;
  kind: "EXPENSE" | "TRANSFER";
  transferAccountId: string | null;
  transferAccountName: string | null;
  transferAccountType: string | null;
  isReviewed: boolean;
  confidence: number;
  tagColor: string | null;
  source: string;
  runningBalance: number;
}

interface StatementData {
  account: { id: string; name: string; type: string; institution: string | null; identifierHint: string | null; openingBalance: number };
  transactions: StatementTxn[];
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });

const TAG_COLORS = [
  { key: "amber", label: "Amber" },
  { key: "rose", label: "Rose" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
  { key: "violet", label: "Violet" },
] as const;

const HIGHLIGHT_COLORS = [
  { key: "yellow", label: "Yellow", dot: "var(--warn)" },
  { key: "green", label: "Green", dot: "var(--pos)" },
  { key: "blue", label: "Blue", dot: "var(--c-transport)" },
  { key: "pink", label: "Pink", dot: "var(--c-health)" },
] as const;

async function patchTxn(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}

export function StatementsClient({ accounts, linkableAccounts }: { accounts: ShellAccount[]; linkableAccounts: LinkableAccount[] }) {
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

  if (accounts.length === 0) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Statements</h1>
        <p style={{ color: "var(--ink-muted)" }}>No bank or card accounts yet — add one under Accounts first.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 18px 40px" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Statements</h1>
        <p className="text-[13px] text-ink-muted">
          Raw ledger, exactly as imported — sort, tag, highlight, and edit right here.
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
              <StatementGrid
                accountId={a.id}
                data={data}
                error={error}
                q={q}
                setQ={setQ}
                linkableAccounts={linkableAccounts.filter((la) => la.id !== a.id)}
                onTxnUpdated={(updated) =>
                  setData((prev) =>
                    prev ? { ...prev, transactions: prev.transactions.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) } : prev
                  )
                }
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StatementGrid({
  accountId,
  data,
  error,
  q,
  setQ,
  linkableAccounts,
  onTxnUpdated,
}: {
  accountId: string;
  data: StatementData | null;
  error: boolean;
  q: string;
  setQ: (v: string) => void;
  linkableAccounts: LinkableAccount[];
  onTxnUpdated: (t: Partial<StatementTxn> & { id: string }) => void;
}) {
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([{ columnKey: "txnDatetime", direction: "DESC" }]);
  const [highlightMode, setHighlightMode] = useState<string | null>(null);
  const [cellHighlights, setCellHighlights] = useState<Map<string, string>>(() => {
    try {
      const raw = localStorage.getItem(`statements-highlight:${accountId}`);
      return raw ? new Map(JSON.parse(raw)) : new Map();
    } catch {
      return new Map();
    }
  });

  const storageKey = `statements-highlight:${accountId}`;

  const toggleHighlight = useCallback(
    (cellKey: string) => {
      setCellHighlights((prev) => {
        const next = new Map(prev);
        if (highlightMode === null) return prev;
        if (next.get(cellKey) === highlightMode) next.delete(cellKey);
        else next.set(cellKey, highlightMode);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // best-effort only — a full localStorage or private-browsing mode just
          // means this session's highlights won't persist, nothing to recover from.
        }
        return next;
      });
    },
    [highlightMode, storageKey]
  );

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

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const sort = sortColumns[0];
    if (!sort) return rows;
    const dir = sort.direction === "ASC" ? 1 : -1;
    const key = sort.columnKey as keyof StatementTxn | "debit" | "credit";
    rows.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (key === "debit") { av = a.direction === "DEBIT" ? a.amount : -1; bv = b.direction === "DEBIT" ? b.amount : -1; }
      else if (key === "credit") { av = a.direction === "CREDIT" ? a.amount : -1; bv = b.direction === "CREDIT" ? b.amount : -1; }
      else if (key === "txnDatetime") { av = a.txnDatetime; bv = b.txnDatetime; }
      else if (key === "runningBalance") { av = a.runningBalance; bv = b.runningBalance; }
      else { av = (a.merchantName || a.rawNarration || "").toLowerCase(); bv = (b.merchantName || b.rawNarration || "").toLowerCase(); }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [filtered, sortColumns]);

  const cellClassFor = useCallback(
    (columnKey: string) => (row: StatementTxn) => {
      const hl = cellHighlights.get(`${row.id}:${columnKey}`);
      const classes: string[] = [];
      if (hl) classes.push(`rdg-hl-${hl}`);
      return classes.join(" ") || undefined;
    },
    [cellHighlights]
  );

  const rowClass = useCallback(
    (row: StatementTxn) => (row.tagColor ? `rdg-tag-${row.tagColor}` : undefined),
    []
  );

  const handleRowsChange = useCallback(
    (newRows: StatementTxn[], colKey: string, rowId: string) => {
      const row = newRows.find((r) => r.id === rowId);
      if (!row) return;
      onTxnUpdated(row);
      if (colKey === "merchantName") {
        patchTxn(rowId, { merchantName: row.merchantName || "" }).catch(() => {
          // optimistic update stands even if the save fails silently in the
          // background; the next full reload will reconcile from the server.
        });
      }
    },
    [onTxnUpdated]
  );

  const columns = useMemo<Column<StatementTxn>[]>(
    () => [
      {
        key: "tag",
        name: "",
        width: 34,
        frozen: true,
        sortable: false,
        renderCell: ({ row }: RenderCellProps<StatementTxn>) => (
          <TagPicker txn={row} onSaved={onTxnUpdated} />
        ),
      },
      {
        key: "txnDatetime",
        name: "Date",
        width: 92,
        sortable: true,
        frozen: true,
        cellClass: cellClassFor("txnDatetime"),
        renderCell: ({ row }) => <span className="text-ink-muted whitespace-nowrap">{dayLabel(row.txnDatetime)}</span>,
      },
      {
        key: "merchantName",
        name: "Narration",
        sortable: true,
        editable: true,
        minWidth: 220,
        cellClass: cellClassFor("merchantName"),
        renderCell: ({ row }) => <span title={row.rawNarration ?? undefined}>{row.merchantName || row.rawNarration || "—"}</span>,
        renderEditCell: ({ row, onRowChange, onClose }) => (
          <input
            className="w-full h-full bg-surface-1 px-2 text-[13px] text-ink outline-none"
            autoFocus
            defaultValue={row.merchantName ?? ""}
            onBlur={(e) => {
              onRowChange({ ...row, merchantName: e.target.value }, true);
              onClose(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRowChange({ ...row, merchantName: e.currentTarget.value }, true); onClose(true); }
              if (e.key === "Escape") onClose(false);
            }}
          />
        ),
      },
      {
        key: "status",
        name: "Type",
        width: 200,
        sortable: false,
        cellClass: cellClassFor("status"),
        renderCell: ({ row }) => (
          <StatusCell txn={row} linkableAccounts={linkableAccounts} onSaved={onTxnUpdated} />
        ),
      },
      {
        key: "debit",
        name: "Debit",
        width: 110,
        sortable: true,
        cellClass: (row) => [cellClassFor("debit")(row), "text-right tabular-nums"].filter(Boolean).join(" "),
        renderCell: ({ row }) => (row.direction === "DEBIT" ? <span>{formatINR(row.amount)}</span> : <span className="text-ink-subtle">—</span>),
      },
      {
        key: "credit",
        name: "Credit",
        width: 110,
        sortable: true,
        cellClass: (row) => [cellClassFor("credit")(row), "text-right tabular-nums"].filter(Boolean).join(" "),
        renderCell: ({ row }) => (row.direction === "CREDIT" ? <span className="text-pos">{formatINR(row.amount)}</span> : <span className="text-ink-subtle">—</span>),
      },
      {
        key: "runningBalance",
        name: "Balance",
        width: 120,
        sortable: true,
        cellClass: (row) => [cellClassFor("runningBalance")(row), "text-right tabular-nums text-ink-muted"].filter(Boolean).join(" "),
        renderCell: ({ row }) => <span>{formatINR(row.runningBalance)}</span>,
      },
    ],
    [cellClassFor, linkableAccounts, onTxnUpdated]
  );

  if (error) return <p className="text-ink-subtle p-6 text-center">Couldn&apos;t load this statement.</p>;
  if (!data) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-1 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-4 mb-2.5" />
        ))}
      </div>
    );
  }

  const latest = data.transactions[0];

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search narration or amount…" className="max-w-xs" />
        <div className="flex items-center gap-1 ml-1">
          <span className="text-[12px] text-ink-subtle mr-1 hidden sm:inline">Highlight:</span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={`${c.label} highlighter`}
              onClick={() => setHighlightMode((m) => (m === c.key ? null : c.key))}
              className="h-6 w-6 rounded-full border transition-transform"
              style={{
                background: c.dot,
                borderColor: highlightMode === c.key ? "var(--ink)" : "transparent",
                transform: highlightMode === c.key ? "scale(1.15)" : undefined,
              }}
            />
          ))}
          {highlightMode && (
            <Button variant="ghost" size="sm" onClick={() => setHighlightMode(null)}>
              <Highlighter size={13} className="mr-1" /> Done
            </Button>
          )}
        </div>
        <div className="text-[13px] text-ink-muted ml-auto">
          {data.transactions.length} entries
          {latest ? (
            <>
              {" "}· closing balance <strong className="text-ink">{formatINR(latest.runningBalance)}</strong>
            </>
          ) : null}
        </div>
      </div>

      {highlightMode && (
        <p className="text-[12px] text-ink-subtle mb-2">
          Highlighter armed — click any cell to mark it, click again to clear. Click &quot;Done&quot; to stop.
        </p>
      )}

      <div className="rdg-shell" style={{ height: `${Math.min(sorted.length * 36 + 36, 640)}px` }}>
        <DataGrid
          columns={columns}
          rows={sorted}
          rowKeyGetter={(r) => r.id}
          rowClass={rowClass}
          sortColumns={sortColumns}
          onSortColumnsChange={setSortColumns}
          onRowsChange={(newRows, { indexes, column }) => {
            for (const idx of indexes) handleRowsChange(newRows, column.key, newRows[idx].id);
          }}
          onCellClick={(args, event) => {
            if (!highlightMode) return;
            event.preventGridDefault();
            toggleHighlight(`${args.row.id}:${args.column.key}`);
          }}
          className="rdg-light"
          style={{ blockSize: "100%" }}
        />
      </div>
    </div>
  );
}

function TagPicker({ txn, onSaved }: { txn: StatementTxn; onSaved: (t: Partial<StatementTxn> & { id: string }) => void }) {
  const [open, setOpen] = useState(false);
  const save = (color: string | null) => {
    onSaved({ id: txn.id, tagColor: color });
    setOpen(false);
    patchTxn(txn.id, { tagColor: color }).catch(() => {});
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full items-center justify-center"
          title="Tag this row"
        >
          <Tag size={12} className={txn.tagColor ? "text-accent" : "text-ink-subtle"} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle mb-2">Tag row</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c.key}
              title={c.label}
              onClick={() => save(c.key)}
              className="h-6 w-6 rounded-full border-2"
              style={{
                background: `var(--${c.key === "amber" ? "warn" : c.key === "rose" ? "neg" : c.key === "green" ? "pos" : c.key === "blue" ? "c-transport" : "c-shop"})`,
                borderColor: txn.tagColor === c.key ? "var(--ink)" : "transparent",
              }}
            />
          ))}
        </div>
        {txn.tagColor && (
          <Button variant="ghost" size="sm" onClick={() => save(null)} className="w-full">
            Clear tag
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatusCell({
  txn,
  linkableAccounts,
  onSaved,
}: {
  txn: StatementTxn;
  linkableAccounts: LinkableAccount[];
  onSaved: (t: Partial<StatementTxn> & { id: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(txn.transferAccountId ?? "");
  const [saving, setSaving] = useState(false);

  const isTransfer = txn.kind === "TRANSFER";
  const isInvestment = isTransfer && txn.transferAccountType === "INVESTMENT";
  const needsReview = !txn.isReviewed;

  const badge = isInvestment ? (
    <Badge variant="accent">Investment</Badge>
  ) : isTransfer ? (
    <Badge variant="accent">Settlement</Badge>
  ) : needsReview ? (
    <Badge variant="warning">Review</Badge>
  ) : txn.categoryName ? (
    <Badge variant="neutral">{txn.categoryName}</Badge>
  ) : (
    <Badge variant="warning">Uncategorized</Badge>
  );

  async function link() {
    if (!target) return;
    setSaving(true);
    try {
      const { transaction } = await patchTxn(txn.id, { kind: "TRANSFER", transferAccountId: target });
      onSaved({ id: txn.id, kind: "TRANSFER", transferAccountId: target, transferAccountName: transaction.transferAccount?.name ?? null, transferAccountType: transaction.transferAccount?.type ?? null });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function unlink() {
    setSaving(true);
    try {
      await patchTxn(txn.id, { kind: "EXPENSE" });
      onSaved({ id: txn.id, kind: "EXPENSE", transferAccountId: null, transferAccountName: null, transferAccountType: null });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-full w-full items-center gap-1.5 px-1 text-left">
          {badge}
          {isTransfer && txn.transferAccountName && (
            <span className="text-[11px] text-ink-subtle truncate">→ {txn.transferAccountName}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        {isTransfer ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle mb-2">
              Linked {isInvestment ? "investment" : "settlement"}
            </p>
            <p className="text-[13px] mb-3">
              Money moved to <strong className="text-ink">{txn.transferAccountName}</strong>
            </p>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Change destination…" /></SelectTrigger>
              <SelectContent>
                {linkableAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={link} disabled={saving || target === txn.transferAccountId} className="flex-1">
                <Link2 size={13} className="mr-1" /> Update
              </Button>
              <Button size="sm" variant="ghost" onClick={unlink} disabled={saving} className="flex-1">
                <Link2Off size={13} className="mr-1" /> Unlink
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle mb-2">Mark as transfer</p>
            <p className="text-[12px] text-ink-subtle mb-2">
              Use this when the row is really a self-transfer or investment contribution/withdrawal, not real spend.
            </p>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Destination account…" /></SelectTrigger>
              <SelectContent>
                {linkableAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={link} disabled={saving || !target} className="w-full mt-2">
              <Link2 size={13} className="mr-1" /> Link as transfer
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
