"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ShellAccount, ShellCategory } from "@/lib/user";
import { formatINR } from "./ui";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./primitives/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "./primitives/drawer";
import { ToggleGroup, ToggleGroupItem } from "./primitives/toggle-group";
import { Button } from "./primitives/button";
import { Input, Label } from "./primitives/input";

const RECENTS = [
  { label: "Swiggy", amount: 0, cat: "food" },
  { label: "Auto ₹60", amount: 60, cat: "transport" },
  { label: "Chai ₹20", amount: 20, cat: "food" },
  { label: "Groceries", amount: 0, cat: "grocery" },
];

export interface EditableTxn {
  id: string;
  amount: number;
  merchantName?: string;
  category: { id: string } | null;
  account: { id: string };
  kind?: string;
  transferAccount?: { id: string; name: string } | null;
}

export function QuickAdd({
  accounts, categories, editTxn, onClose, onSaved,
}: { accounts: ShellAccount[]; categories: ShellCategory[]; editTxn?: EditableTxn; onClose: () => void; onSaved: (msg: string) => void }) {
  const isDesktop = useMediaQuery("(min-width: 820px)");
  const isEdit = !!editTxn;
  const [amount, setAmount] = useState(editTxn ? String(editTxn.amount) : "");
  const defaultCat = categories.find((c) => c.colorToken === "food") ?? categories[0];
  const defaultAcc = accounts.find((a) => a.type === "CREDIT_CARD") ?? accounts[0];
  const [catId, setCatId] = useState(editTxn?.category?.id ?? defaultCat?.id);
  const [accId, setAccId] = useState(editTxn?.account.id ?? defaultAcc?.id);
  const [merchant, setMerchant] = useState(editTxn?.merchantName ?? "");
  const [isTransfer, setIsTransfer] = useState(editTxn?.kind === "TRANSFER");
  const [transferAccId, setTransferAccId] = useState(editTxn?.transferAccount?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingChanges, setConfirmingChanges] = useState(false);
  const [rememberMerchant, setRememberMerchant] = useState(false);
  // React state updates from an onClick handler aren't guaranteed to have
  // committed (and re-rendered `disabled`) before a second rapid click/Enter
  // fires — a ref is checked synchronously so a double-submit can't slip through.
  const savingRef = useRef(false);
  const desktopAmountRef = useRef<HTMLInputElement>(null);

  // Desktop has a real keyboard — jump straight into the amount field instead
  // of making people tap a number out on an on-screen keypad built for thumbs.
  useEffect(() => {
    if (isDesktop) desktopAmountRef.current?.focus();
  }, [isDesktop]);

  const topCats = useMemo(() => categories.filter((c) => c.colorToken !== "income").slice(0, 6), [categories]);

  function press(k: string) {
    setConfirmingChanges(false);
    if (k === "⌫") setAmount((a) => a.slice(0, -1));
    else if (k === ".") setAmount((a) => (a.includes(".") ? a : a + "."));
    else setAmount((a) => (a === "0" ? k : a + k));
  }

  function typeAmount(raw: string) {
    setConfirmingChanges(false);
    if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) setAmount(raw);
  }

  async function save() {
    const amt = parseFloat(amount);
    if (!amt || !accId || savingRef.current) return;
    // Editing an existing (already-reviewed) transaction needs an explicit
    // confirm step before the PATCH actually fires — the first tap just
    // reveals the confirmation bar, the second tap (below) does the save.
    if (isEdit && !confirmingChanges) { setConfirmingChanges(true); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const cat = categories.find((c) => c.id === catId);
      // Best-effort — teaching a rule (and backfilling past misc/uncategorized txns
      // from this merchant) shouldn't block or fail the transaction save itself.
      if (rememberMerchant && !isTransfer && merchant.trim() && catId) {
        fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchantName: merchant.trim(), categoryId: catId, applyToPast: true }),
        }).catch(() => {});
      }
      if (isEdit && editTxn) {
        const res = await fetch(`/api/transactions/${editTxn.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amt, accountId: accId, categoryId: catId, merchantName: merchant || undefined,
            kind: isTransfer ? "TRANSFER" : "EXPENSE",
            transferAccountId: isTransfer ? (transferAccId || null) : null,
          }),
        });
        if (!res.ok) throw new Error("save failed");
        onSaved(isTransfer ? `${formatINR(amt)} payment saved` : `${formatINR(amt)} · ${cat?.name ?? ""} updated`);
      } else {
        const rail = accounts.find((a) => a.id === accId)?.type === "CASH" ? "CASH" : "UPI";
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, accountId: accId, categoryId: catId, merchantName: merchant || undefined, paymentRail: rail }),
        });
        if (!res.ok) throw new Error("save failed");
        onSaved(`${formatINR(amt)} · ${cat?.name ?? ""} saved`);
      }
      onClose();
    } catch {
      setError(isEdit ? "Couldn't save changes — check your connection and try again." : "Couldn't save — check your connection and try again.");
      setConfirmingChanges(false);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const recentsPicker = (
    <div>
      <Label>Recents</Label>
      <div className="flex flex-wrap gap-2">
        {RECENTS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => { setConfirmingChanges(false); if (r.amount) setAmount(String(r.amount)); const c = categories.find((x) => x.colorToken === (r.cat === "shopping" ? "shop" : r.cat)); if (c) setCatId(c.id); setMerchant(r.label.replace(/ ₹.*/, "")); }}
            className="cursor-pointer whitespace-nowrap rounded-full border border-hairline bg-surface-1 px-3 py-2 text-[12.5px] font-semibold text-ink"
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );

  const categoryPicker = !isTransfer && (
    <div>
      <Label>Category</Label>
      <ToggleGroup
        type="single"
        value={catId}
        onValueChange={(v) => { if (v) { setConfirmingChanges(false); setCatId(v); } }}
        className="flex flex-wrap gap-2"
      >
        {topCats.map((c) => (
          <ToggleGroupItem key={c.id} value={c.id}>
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--c-${c.colorToken})` }} />
            {c.name.split(" ")[0]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {merchant.trim() && (
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-muted">
          <input type="checkbox" checked={rememberMerchant} onChange={(e) => setRememberMerchant(e.target.checked)} className="accent-accent" />
          Always categorize &ldquo;{merchant.trim()}&rdquo; this way
        </label>
      )}
    </div>
  );

  const accountPicker = (
    <div>
      <Label>Account</Label>
      <ToggleGroup
        type="single"
        value={accId}
        onValueChange={(v) => { if (v) { setConfirmingChanges(false); setAccId(v); } }}
        className="flex flex-wrap gap-2"
      >
        {accounts.map((a) => (
          <ToggleGroupItem key={a.id} value={a.id}>{a.name}</ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );

  const typeAndTransferPicker = (
    <>
      {isEdit && (
        <div>
          <Label>Type</Label>
          <ToggleGroup
            type="single"
            value={isTransfer ? "transfer" : "expense"}
            onValueChange={(v) => { if (v) { setConfirmingChanges(false); setIsTransfer(v === "transfer"); } }}
            className="flex flex-wrap gap-2"
          >
            <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
            <ToggleGroupItem value="transfer">Payment to another account</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
      {isTransfer && (
        <div>
          <Label>Paying towards</Label>
          <ToggleGroup
            type="single"
            value={transferAccId}
            onValueChange={(v) => { if (v) { setConfirmingChanges(false); setTransferAccId(v); } }}
            className="flex flex-wrap gap-2"
          >
            {accounts.filter((a) => a.id !== accId).map((a) => (
              <ToggleGroupItem key={a.id} value={a.id}>{a.name}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </>
  );

  const merchantField = (
    <div>
      <Label>Merchant / note</Label>
      <Input value={merchant} onChange={(e) => { setConfirmingChanges(false); setMerchant(e.target.value); }} placeholder="Optional" />
    </div>
  );

  const errorBanner = error && <div role="alert" className="text-[13px] text-neg">{error}</div>;

  const saveLabel = saving
    ? "Saving…"
    : confirmingChanges
      ? "Confirm changes"
      : isEdit
        ? "Save changes"
        : `Save${amount ? " · " + formatINR(parseFloat(amount) || 0) : ""}`;

  // ---------------------------------------------------------------- Desktop
  if (isDesktop) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <div className="flex h-9 items-center gap-1 rounded-[10px] border border-hairline-strong bg-surface-2 px-3">
                  <span className="text-[15px] text-ink-subtle">₹</span>
                  <input
                    ref={desktopAmountRef}
                    className="num min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none"
                    value={amount}
                    onChange={(e) => typeAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Amount"
                  />
                </div>
              </div>
              {merchantField}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {accountPicker}
              {categoryPicker}
            </div>
            {typeAndTransferPicker}
            {recentsPicker}
            {errorBanner}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={confirmingChanges ? () => setConfirmingChanges(false) : onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !amount}>{saveLabel}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // ------------------------------------------------------------------ Mobile
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerTitle className="sr-only">{isEdit ? "Edit expense" : "Add expense"}</DrawerTitle>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex-1 overflow-y-auto px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
          {isEdit && <div className="mb-1.5 text-center text-[13px] font-semibold text-ink-muted">Edit expense</div>}
          <div className="num text-center text-[46px] font-semibold leading-tight tracking-tight" style={{ minHeight: 54 }}>
            <span className="text-[28px] text-ink-subtle">₹</span>{amount || "0"}
          </div>

          <input
            value={merchant}
            onChange={(e) => { setConfirmingChanges(false); setMerchant(e.target.value); }}
            placeholder="Add a note or merchant (optional)"
            className="my-2 w-full bg-transparent text-center text-[14px] text-ink-muted outline-none"
          />

          <div className="space-y-4">
            {recentsPicker}
            {categoryPicker}
            {accountPicker}
            {typeAndTransferPicker}
          </div>

          <div className="my-3 grid grid-cols-3 gap-1.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="cursor-pointer rounded-[10px] bg-surface-2 py-3 text-center text-[20px] font-medium text-ink"
              >
                {k}
              </button>
            ))}
          </div>

          {error && <div role="alert" className="mb-2 text-center text-[13px] text-neg">{error}</div>}

          {confirmingChanges ? (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmingChanges(false)} disabled={saving} className="h-[52px] flex-1 rounded-[13px] text-[15px]">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="h-[52px] flex-[2] rounded-[13px] text-[15px]">
                {saving ? "Saving…" : "Confirm changes"}
              </Button>
            </div>
          ) : (
            <Button type="submit" disabled={saving || !amount} className="h-[52px] w-full rounded-[13px] text-[15px]">
              {saveLabel}
            </Button>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  );
}
