'use client';

import { useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { getAccountTotals, getPaymentMethodTotals, formatCurrency } from '@/lib/calculations';
import DashboardCard from '@/components/DashboardCard';

const PM_ICONS: Record<string, string> = {
    Cash: '💵',
    UPI: '📱',
    'Credit Card': '💳',
    'Debit Card': '🏧',
    'Net Banking': '🏦',
    Wallet: '👝',
};

export default function AccountsPage() {
    const { expenses, isLoaded } = useExpenseStore();

    const paymentMethodTotals = useMemo(
        () => getPaymentMethodTotals(expenses),
        [expenses]
    );

    const accountTotals = useMemo(
        () => getAccountTotals(expenses),
        [expenses]
    );

    const totalSpend = useMemo(
        () => expenses.reduce((sum, e) => sum + e.amount, 0),
        [expenses]
    );

    if (!isLoaded) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-4">
            {/* Total lifetime spend */}
            <DashboardCard title="Total Lifetime Spend">
                <p className="text-3xl font-bold tracking-tight text-gray-800 dark:text-white">
                    {formatCurrency(totalSpend)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
                </p>
            </DashboardCard>

            {/* Payment methods */}
            <DashboardCard title="By Payment Method (This Month)">
                {paymentMethodTotals.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                        No expenses this month
                    </p>
                ) : (
                    <div className="space-y-3">
                        {paymentMethodTotals.map((pm) => {
                            const percent =
                                paymentMethodTotals.reduce((s, p) => s + p.value, 0) > 0
                                    ? (pm.value /
                                        paymentMethodTotals.reduce(
                                            (s, p) => s + p.value,
                                            0
                                        )) *
                                    100
                                    : 0;
                            return (
                                <div key={pm.name}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">
                                                {PM_ICONS[pm.name] || '💰'}
                                            </span>
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                                {pm.name}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-white">
                                            {formatCurrency(pm.value)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700/50 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </DashboardCard>

            {/* Account breakdown */}
            <DashboardCard title="Account Breakdown (All Time)">
                {accountTotals.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                        No expenses recorded
                    </p>
                ) : (
                    <div className="space-y-2">
                        {accountTotals.map((acc, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5"
                            >
                                <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {acc.paymentMethod}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {acc.account}
                                    </p>
                                </div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                    {formatCurrency(acc.total)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </DashboardCard>
        </div>
    );
}
