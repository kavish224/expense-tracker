"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ShellAccount, ShellCategory } from "@/lib/user";
import { Dot, formatINR, useFocusTrap } from "./ui";

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
  const containerRef = useRef<HTMLFormElement>(null);
  const desktopAmountRef = useRef<HTMLInputElement>(null);
  useFocusTrap(containerRef, true);

  // Desktop/tablet (>=820px, matching AppShell's rail breakpoint) has a real keyboard
  // and pointer available — jump straight into the amount field instead of making
  // people tap out a number on an on-screen keypad built for thumbs.
  useEffect(() => {
    if (window.matchMedia("(min-width: 820px)").matches) desktopAmountRef.current?.focus();
  }, []);

  const topCats = useMemo(() => categories.filter((c) => c.colorToken !== "income").slice(0, 6), [categories]);

  function press(k: string) {
    setConfirmingChanges(false);
    if (k === "⌫") setAmount((a) => a.slice(0, -1));
    else if (k === "." ) setAmount((a) => (a.includes(".") ? a : a + "."));
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

  return (
    <div onClick={onClose} className="qa-overlay anim-fade" style={overlay}>
      <form
        ref={containerRef}
        role="dialog" aria-modal="true" aria-label={isEdit ? "Edit expense" : "Add expense"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); save(); }}
        className="qa-sheet anim-sheet" style={sheet}
      >
        <div className="qa-grabber" style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline-strong)", margin: "0 auto 16px" }} />
        {isEdit && <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 6 }}>Edit expense</div>}
        <div className="num qa-amt-display" style={{ textAlign: "center", fontSize: 46, fontWeight: 600, letterSpacing: "-0.02em", minHeight: 54 }}>
          <span style={{ color: "var(--ink-subtle)", fontSize: 28 }}>₹</span>{amount || "0"}
        </div>
        <div className="qa-amt-input" style={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
          <span style={{ color: "var(--ink-subtle)", fontSize: 28 }}>₹</span>
          <input
            ref={desktopAmountRef}
            className="num"
            value={amount}
            onChange={(e) => typeAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount"
            style={{ width: 200, textAlign: "center", fontSize: 46, fontWeight: 600, letterSpacing: "-0.02em", background: "transparent", border: "none", outline: "none", color: "var(--ink)", fontFamily: "inherit" }}
          />
        </div>

        <input value={merchant} onChange={(e) => { setConfirmingChanges(false); setMerchant(e.target.value); }} placeholder="Add a note or merchant (optional)"
          style={{ width: "100%", textAlign: "center", background: "transparent", border: "none", color: "var(--ink-muted)", fontSize: 14, margin: "8px 0 4px", outline: "none", fontFamily: "inherit" }} />

        <Label>Recents</Label>
        <Row>
          {RECENTS.map((r) => (
            <Chip key={r.label} onClick={() => { setConfirmingChanges(false); if (r.amount) setAmount(String(r.amount)); const c = categories.find((x) => x.colorToken === (r.cat === "shopping" ? "shop" : r.cat)); if (c) setCatId(c.id); setMerchant(r.label.replace(/ ₹.*/, "")); }}>
              {r.label}
            </Chip>
          ))}
        </Row>

        {!isTransfer && (
          <>
            <Label>Category</Label>
            <Row>
              {topCats.map((c) => (
                <Chip key={c.id} selected={c.id === catId} onClick={() => { setConfirmingChanges(false); setCatId(c.id); }}>
                  <Dot token={c.colorToken} size={8} /> {c.name.split(" ")[0]}
                </Chip>
              ))}
            </Row>
            {merchant.trim() && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 2px 0", fontSize: 12.5, color: "var(--ink-muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={rememberMerchant} onChange={(e) => setRememberMerchant(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                Always categorize &ldquo;{merchant.trim()}&rdquo; this way
              </label>
            )}
          </>
        )}

        <Label>Account</Label>
        <Row>
          {accounts.map((a) => (
            <Chip key={a.id} selected={a.id === accId} onClick={() => { setConfirmingChanges(false); setAccId(a.id); }}>{a.name}</Chip>
          ))}
        </Row>

        {isEdit && (
          <>
            <Label>Type</Label>
            <Row>
              <Chip selected={!isTransfer} onClick={() => { setConfirmingChanges(false); setIsTransfer(false); }}>Expense</Chip>
              <Chip selected={isTransfer} onClick={() => { setConfirmingChanges(false); setIsTransfer(true); }}>Payment to another account</Chip>
            </Row>
          </>
        )}

        {isTransfer && (
          <>
            <Label>Paying towards</Label>
            <Row>
              {accounts.filter((a) => a.id !== accId).map((a) => (
                <Chip key={a.id} selected={a.id === transferAccId} onClick={() => { setConfirmingChanges(false); setTransferAccId(a.id); }}>{a.name}</Chip>
              ))}
            </Row>
          </>
        )}

        <div className="qa-numpad" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, margin: "12px 0" }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
            <button key={k} type="button" onClick={() => press(k)} style={key}>{k}</button>
          ))}
        </div>

        {error && <div role="alert" style={{ color: "var(--neg)", fontSize: 13, textAlign: "center", margin: "0 0 8px" }}>{error}</div>}
        {confirmingChanges ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setConfirmingChanges(false)} disabled={saving} style={{ flex: 1, background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--hairline-strong)", borderRadius: 13, padding: 15, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-x btn-p" style={{ flex: 2, background: "var(--accent-grad)", color: "#fff", border: "none", borderRadius: 13, padding: 15, fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.16)" }}>
              {saving ? "Saving…" : "Confirm changes"}
            </button>
          </div>
        ) : (
          <button type="submit" disabled={saving || !amount} className={amount ? "btn-x btn-p" : undefined} style={{ width: "100%", background: "var(--accent-grad)", color: "#fff", border: "none", borderRadius: 13, padding: 15, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: !amount ? 0.5 : 1, boxShadow: amount ? "0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.16)" : "none" }}>
            {saving ? "Saving…" : isEdit ? "Save changes" : `Save${amount ? " · " + formatINR(parseFloat(amount) || 0) : ""}`}
          </button>
        )}
      </form>
      <style>{responsiveCss}</style>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="overline" style={{ margin: "12px 2px 8px", fontSize: 11 }}>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="qa-row" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>{children}</div>;
}
function Chip({ children, selected, onClick }: { children: React.ReactNode; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontFamily: "inherit",
      fontSize: 12.5, fontWeight: 600, padding: "8px 12px", borderRadius: 999, cursor: "pointer",
      border: `1px solid ${selected ? "var(--accent)" : "var(--hairline)"}`,
      background: selected ? "var(--accent-tint)" : "var(--surface-1)",
      color: selected ? "var(--accent)" : "var(--ink)",
    }}>{children}</button>
  );
}
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const sheet: React.CSSProperties = { width: "100%", maxWidth: 440, background: "var(--surface-1)", borderRadius: "20px 20px 0 0", border: "1px solid var(--hairline)", padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", maxHeight: "92dvh", overflowY: "auto" };
const key: React.CSSProperties = { padding: "12px 0", textAlign: "center", fontSize: 20, fontWeight: 500, borderRadius: 10, background: "var(--surface-2)", border: "none", color: "var(--ink)", cursor: "pointer", fontFamily: "inherit" };

// Desktop/tablet (>=820px): a real keyboard makes the tap-numpad pure overhead, and
// there's room for a centered dialog instead of a thumb-reachable bottom sheet — chip
// rows can wrap instead of horizontal-scrolling so every option is a single click.
const responsiveCss = `
  .qa-amt-input{display:none}
  .qa-numpad{display:grid}
  @media(min-width:820px){
    .qa-overlay{align-items:center}
    .qa-sheet{max-width:480px;border-radius:20px;padding-bottom:20px;max-height:86vh}
    .qa-grabber{display:none}
    .qa-amt-display{display:none}
    .qa-amt-input{display:flex}
    .qa-numpad{display:none}
    .qa-row{flex-wrap:wrap;overflow-x:visible}
  }
`;
