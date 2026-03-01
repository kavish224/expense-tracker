'use client';

import { useState, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useToast } from '@/components/Toast';
import {
    getAccountTotals,
    formatCurrency,
} from '@/lib/calculations';
import { Account } from '@/lib/types';

export default function Accounts() {
    const { expenses, accounts, addAccount, deleteAccount } = useExpenseStore();
    const { showToast } = useToast();

    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'Bank' | 'CreditCard'>('Bank');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addingAccount, setAddingAccount] = useState(false);
    // Track which account id is pending deletion (inline confirm)
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingInProgress, setDeletingInProgress] = useState(false);

    const totalSpend = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
    const accountBreakdown = useMemo(() => getAccountTotals(expenses), [expenses]);

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || addingAccount) return;

        let finalName = newName.trim();
        if (newType === 'CreditCard' && !finalName.toLowerCase().endsWith('cc')) {
            finalName += ' (CC)';
        }

        setAddingAccount(true);
        try {
            await addAccount({ name: finalName, type: newType });
            showToast('Account added', 'success');
            setNewName('');
            setShowAddForm(false);
        } catch {
            showToast('Failed to add account. Please try again.', 'error');
        } finally {
            setAddingAccount(false);
        }
    };

    const handleDeleteAccount = async (acc: Account) => {
        if (deletingInProgress) return;
        setDeletingInProgress(true);
        try {
            await deleteAccount(acc.id);
            showToast(`"${acc.name}" removed`, 'success');
            setDeletingId(null);
        } catch {
            showToast('Failed to remove account. Please try again.', 'error');
        } finally {
            setDeletingInProgress(false);
        }
    };

    return (
        <main className="mx-auto max-w-lg px-4 pt-5 pb-8 space-y-6">

            {/* Hero — lifetime spend */}
            <div className="kavish-card px-5 py-5">
                <p className="text-[13px] font-medium text-(--color-text-secondary) mb-1">Total lifetime spend</p>
                <p className="text-[40px] font-bold text-(--color-text-primary) tracking-tight leading-none">
                    {formatCurrency(totalSpend)}
                </p>
                <p className="text-[13px] text-(--color-text-muted) mt-2">{expenses.length} transactions</p>
            </div>

            {/* Accounts list */}
            <div>
                <div className="flex items-center justify-between px-1 mb-2">
                    <p className="text-[13px] font-semibold text-(--color-text-secondary) uppercase tracking-wide">My Accounts</p>
                    {!showAddForm && (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="flex items-center gap-1 text-[14px] font-medium text-(--color-accent) active:opacity-60 transition-opacity"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add
                        </button>
                    )}
                </div>

                <div className="kavish-card">
                    {accounts.length > 0 ? (
                        <div className="divide-y divide-(--color-border2)">
                            {accounts.map((acc) => (
                                <div key={acc.id}>
                                    <div className="kavish-row">
                                        {/* Icon */}
                                        <div className="w-9 h-9 rounded-[9px] bg-(--color-surface2) flex items-center justify-center shrink-0 mr-3">
                                            {acc.type === 'CreditCard' ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="2" y="5" width="20" height="14" rx="3" /><line x1="2" y1="10" x2="22" y2="10" />
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] font-medium text-(--color-text-primary)">{acc.name}</p>
                                            <p className="text-[13px] text-(--color-text-secondary)">{acc.type === 'Bank' ? 'Bank Account' : 'Credit Card'}</p>
                                        </div>
                                        <button
                                            onClick={() => setDeletingId(deletingId === acc.id ? null : acc.id)}
                                            disabled={deletingInProgress}
                                            className="h-8 w-8 rounded-full flex items-center justify-center text-(--color-text-muted) active:text-(--color-red) active:bg-(--color-red)/10 transition-colors disabled:opacity-30"
                                            aria-label="Delete account"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Inline confirmation — no window.confirm() */}
                                    {deletingId === acc.id && (
                                        <div className="mx-4 mb-3 bg-(--color-red)/10 border border-(--color-red)/20 rounded-xl px-4 py-3 flex items-center justify-between ios-fade-in">
                                            <p className="text-[13px] font-medium text-(--color-red)">Remove &ldquo;{acc.name}&rdquo;?</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setDeletingId(null)}
                                                    disabled={deletingInProgress}
                                                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-(--color-text-secondary) bg-(--color-surface2) active:opacity-70 transition-opacity"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAccount(acc)}
                                                    disabled={deletingInProgress}
                                                    className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-(--color-red) active:opacity-80 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
                                                >
                                                    {deletingInProgress ? (
                                                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                                    ) : null}
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center gap-2 text-center">
                            <p className="text-[15px] font-medium text-(--color-text-secondary)">No accounts yet</p>
                            <p className="text-[13px] text-(--color-text-muted)">Tap Add to create your first account</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add account form */}
            {showAddForm && (
                <div className="kavish-card p-5 space-y-4 ios-fade-in">
                    <p className="text-[17px] font-semibold text-(--color-text-primary)">New Account</p>

                    <div>
                        <label className="text-[13px] text-(--color-text-secondary) block mb-1.5">Account name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="e.g. HDFC Savings, ICICI CC"
                            autoFocus
                            disabled={addingAccount}
                            maxLength={50}
                            className="w-full h-11 bg-(--color-surface2) rounded-[10px] px-4 text-[15px] text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none border border-(--color-border2) focus:border-(--color-accent) transition-colors disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="text-[13px] text-(--color-text-secondary) block mb-1.5">Type</label>
                        <div className="flex bg-(--color-surface2) rounded-[10px] p-0.5 gap-0.5">
                            <button
                                type="button"
                                onClick={() => setNewType('Bank')}
                                disabled={addingAccount}
                                className={`flex-1 py-2 rounded-lg text-[14px] font-medium transition-all ${newType === 'Bank' ? 'bg-(--color-accent) text-white' : 'text-(--color-text-secondary)'}`}
                            >
                                Bank Account
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewType('CreditCard')}
                                disabled={addingAccount}
                                className={`flex-1 py-2 rounded-lg text-[14px] font-medium transition-all ${newType === 'CreditCard' ? 'bg-(--color-accent) text-white' : 'text-(--color-text-secondary)'}`}
                            >
                                Credit Card
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => { setShowAddForm(false); setNewName(''); }}
                            disabled={addingAccount}
                            className="flex-1 h-11 rounded-[10px] text-[15px] font-medium text-(--color-text-secondary) bg-(--color-surface2) active:opacity-70 transition-opacity disabled:opacity-40"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddAccount}
                            disabled={!newName.trim() || addingAccount}
                            className="flex-1 h-11 rounded-[10px] text-[15px] font-semibold text-white bg-(--color-accent) disabled:opacity-40 active:opacity-80 transition-opacity shadow-[0_2px_8px_rgba(255,87,34,0.3)] flex items-center justify-center gap-2"
                        >
                            {addingAccount ? (
                                <>
                                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    <span>Adding…</span>
                                </>
                            ) : 'Add Account'}
                        </button>
                    </div>
                </div>
            )}

            {/* Spending by account */}
            {accountBreakdown.length > 0 && (
                <div>
                    <p className="text-[13px] font-semibold text-(--color-text-secondary) uppercase tracking-wide px-1 mb-2">Spending by Account</p>
                    <div className="kavish-card divide-y divide-(--color-border2)">
                        {accountBreakdown.map((item, idx) => (
                            <div key={`${item.paymentMethod}-${item.account}-${idx}`} className="kavish-row">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[15px] font-medium text-(--color-text-primary)">{item.accountName || item.paymentMethod}</p>
                                    {item.accountName && (
                                        <p className="text-[13px] text-(--color-text-secondary)">{item.paymentMethod}</p>
                                    )}
                                </div>
                                <p className="text-[15px] font-medium text-(--color-text-primary)">{formatCurrency(item.total)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info note */}
            <div className="kavish-card px-4 py-3 flex items-start gap-3">
                <svg className="shrink-0 mt-0.5 text-(--color-text-muted)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p className="text-[13px] text-(--color-text-secondary) leading-relaxed">
                    Removing an account unlinks it from past expenses but does not delete the expenses themselves.
                </p>
            </div>

        </main>
    );
}
