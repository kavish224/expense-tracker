'use client';

import { useState, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import DashboardCard from '@/components/DashboardCard';
import {
    getAccountTotals,
    getPaymentMethodTotals,
    formatCurrency,
} from '@/lib/calculations';
import { PAYMENT_METHODS } from '@/lib/types';

export default function Accounts() {
    const { expenses, accounts, addAccount, deleteAccount } = useExpenseStore();

    // Form state
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'Bank' | 'CreditCard'>('Bank');
    const [showAddForm, setShowAddForm] = useState(false);

    const totalSpend = useMemo(
        () => expenses.reduce((sum, e) => sum + e.amount, 0),
        [expenses]
    );

    const paymentMethodData = useMemo(() => getPaymentMethodTotals(expenses), [expenses]);
    const accountBreakdown = useMemo(() => getAccountTotals(expenses), [expenses]);

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        let finalName = newName.trim();
        if (newType === 'CreditCard' && !finalName.toLowerCase().endsWith('cc')) {
            finalName += ' (CC)';
        }

        await addAccount({
            name: finalName,
            type: newType
        });

        setNewName('');
        setShowAddForm(false);
    };

    return (
        <main className="mx-auto max-w-lg px-4 py-6 space-y-6 mb-20">
            <div className="kavish-card p-6 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg)]">
                <p className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium mb-1">
                    Total Lifetime Spend
                </p>
                <div className="flex items-baseline gap-2">
                    <h2 className="text-[32px] font-bold text-[var(--color-text-primary)] tracking-tight">
                        {formatCurrency(totalSpend)}
                    </h2>
                    <span className="text-[14px] text-[var(--color-text-secondary)] mb-1">
                        ({expenses.length} transactions)
                    </span>
                </div>
            </div>

            {/* Dynamic Account Management */}
            <DashboardCard title="Manage Accounts & Cards">
                <div className="space-y-4">
                    {accounts.length > 0 ? (
                        <div className="space-y-2">
                            {accounts.map((acc) => (
                                <div key={acc.id} className="flex items-center justify-between p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border2)]">
                                    <div>
                                        <p className="font-semibold text-[13px] text-[var(--color-text-primary)]">{acc.name}</p>
                                        <p className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">
                                            {acc.type === 'Bank' ? 'Bank Account' : 'Credit Card'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => deleteAccount(acc.id)}
                                        className="p-2 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-4 text-[var(--color-text-secondary)] text-[13px]">
                            No custom accounts added yet.
                        </p>
                    )}

                    {!showAddForm ? (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="w-full py-2.5 border-2 border-dashed border-[var(--color-border)] rounded text-[13px] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all"
                        >
                            + Add New Account / Card
                        </button>
                    ) : (
                        <form onSubmit={handleAddAccount} className="p-4 rounded bg-[var(--color-surface2)] border border-[var(--color-border)] space-y-4">
                            <div>
                                <label className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-1 block">Account Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. HDFC Bank, ICICI Credit Card"
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-1 block">Source Type</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewType('Bank')}
                                        className={`flex-1 py-1.5 rounded text-[11px] font-medium border transition-all ${newType === 'Bank'
                                            ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                                            : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)]'
                                            }`}
                                    >
                                        Bank Account
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewType('CreditCard')}
                                        className={`flex-1 py-1.5 rounded text-[11px] font-medium border transition-all ${newType === 'CreditCard'
                                            ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                                            : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)]'
                                            }`}
                                    >
                                        Credit Card
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="flex-1 py-2 text-[13px] font-medium bg-[var(--color-bg)] text-[var(--color-text-secondary)] rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 text-[13px] font-medium bg-[var(--color-accent)] text-white rounded"
                                >
                                    Add Account
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </DashboardCard>

            <DashboardCard title="Positions (By Account)" className="!p-0 overflow-hidden">
                {accountBreakdown.length > 0 ? (
                    <div>
                        {accountBreakdown.map((account, idx) => (
                            <div key={`${account.paymentMethod}-${account.account}-${idx}`} className="kavish-row hover:bg-[var(--color-surface2)]">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-semibold text-[13px]">{account.accountName || account.paymentMethod}</span>
                                        {account.accountName && (
                                            <span className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-tight">
                                                • {account.paymentMethod}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">All-time utilization</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-[13px] text-[var(--color-text-primary)]">
                                        {formatCurrency(account.total)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center py-8 text-[var(--color-text-secondary)] text-[13px]">
                        No account data available
                    </p>
                )}
            </DashboardCard>

            {/* kavish style info card */}
            <div className="p-4 rounded bg-[var(--color-surface2)] flex gap-3 border border-[var(--color-border2)]">
                <div className="text-[color:var(--color-accent)] mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </div>
            </div>
        </main>
    );
}
