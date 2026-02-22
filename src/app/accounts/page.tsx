'use client';

import { useExpenseStore } from '@/store/useExpenseStore';
import DashboardCard from '@/components/DashboardCard';
import {
    getAccountTotals,
    getPaymentMethodTotals,
    formatCurrency,
} from '@/lib/calculations';
import { useMemo } from 'react';

export default function Accounts() {
    const expenses = useExpenseStore((s) => s.expenses);

    const totalSpend = useMemo(
        () => expenses.reduce((sum, e) => sum + e.amount, 0),
        [expenses]
    );

    const paymentMethodData = useMemo(() => getPaymentMethodTotals(expenses), [expenses]);
    const accountBreakdown = useMemo(() => getAccountTotals(expenses), [expenses]);

    // Max value for progress bars
    const maxMethodValue = useMemo(() =>
        Math.max(...paymentMethodData.map(d => d.value), 1),
        [paymentMethodData]
    );

    return (
        <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
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

            <DashboardCard title="Funds Breakdown (This Month)">
                <div className="space-y-4">
                    {paymentMethodData.length > 0 ? (
                        paymentMethodData.map((item) => (
                            <div key={item.name} className="space-y-1.5">
                                <div className="flex justify-between text-[13px]">
                                    <span className="font-medium text-[var(--color-text-primary)]">{item.name}</span>
                                    <span className="font-semibold text-[color:var(--color-accent)]">{formatCurrency(item.value)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-[var(--color-surface2)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                                        style={{ width: `${(item.value / maxMethodValue) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center py-4 text-[var(--color-text-secondary)] text-[13px]">
                            No transactions to display
                        </p>
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
                                        <span className="font-semibold text-[13px]">{account.paymentMethod}</span>
                                        <span className="text-[11px] text-[var(--color-text-secondary)]">({account.account})</span>
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
                <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                    Your ledger is stored locally on this device. Clearing your browser data will permanently delete your expense history unless exported.
                </p>
            </div>
        </main>
    );
}
