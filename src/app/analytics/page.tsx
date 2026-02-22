'use client';

import { useExpenseStore } from '@/store/useExpenseStore';
import DashboardCard from '@/components/DashboardCard';
import {
    getCategoryTotals,
    getMonthlyTrend,
    getDailyAverage,
    getLargestExpense,
    getMonthOverMonthChange,
    formatCurrency,
} from '@/lib/calculations';
import { CATEGORY_COLORS } from '@/lib/types';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { useMemo } from 'react';

export default function Analytics() {
    const expenses = useExpenseStore((s) => s.expenses);

    const monthlyTrend = useMemo(() => getMonthlyTrend(expenses), [expenses]);
    const categoryTotals = useMemo(() => getCategoryTotals(expenses), [expenses]);
    const dailyAverage = useMemo(() => getDailyAverage(expenses), [expenses]);
    const largestExpenseValue = useMemo(() => getLargestExpense(expenses), [expenses]);
    const momChangeData = useMemo(() => getMonthOverMonthChange(expenses), [expenses]);

    return (
        <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
            {/* Analytics Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="kavish-card p-4">
                    <p className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium mb-1">
                        Daily Avg
                    </p>
                    <p className="text-[20px] font-semibold text-[var(--color-text-primary)]">
                        {formatCurrency(dailyAverage)}
                    </p>
                </div>
                <div className="kavish-card p-4">
                    <p className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium mb-1">
                        MoM Change
                    </p>
                    <p className={`text-[20px] font-semibold ${momChangeData.change >= 0 ? 'kavish-red' : 'kavish-green'}`}>
                        {momChangeData.change > 0 ? '+' : ''}{momChangeData.change.toFixed(1)}%
                    </p>
                </div>
            </div>

            <DashboardCard title="Monthly Trend">
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border2)" vertical={false} />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                                tickFormatter={(val) => `₹${val / 1000}k`}
                                width={45}
                            />
                            <Tooltip
                                formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                                contentStyle={{
                                    backgroundColor: 'var(--color-surface)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                }}
                                itemStyle={{ color: 'var(--color-text-primary)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="total"
                                stroke="#ff5722"
                                strokeWidth={2.5}
                                dot={{ fill: '#ff5722', r: 4, strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </DashboardCard>

            <DashboardCard title="By Category">
                <div className="h-64 w-full">
                    {categoryTotals.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryTotals} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border2)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-text-primary)', fontSize: 12 }}
                                    width={80}
                                />
                                <Tooltip
                                    formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                                    contentStyle={{
                                        backgroundColor: 'var(--color-surface)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                    }}
                                    itemStyle={{ color: 'var(--color-text-primary)' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {categoryTotals.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || '#ff5722'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)] text-[13px]">
                            Not enough data for allocation view
                        </div>
                    )}
                </div>
            </DashboardCard>

            {/* Largest Expense Highlight */}
            {largestExpenseValue && (
                <div className="kavish-card p-5 border-l-4 border-[var(--color-red)]">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium mb-1">
                                Maximum Drawdown (Largest Expense)
                            </p>
                            <h4 className="text-[18px] font-semibold text-[var(--color-text-primary)] mb-1">
                                {largestExpenseValue.category}
                            </h4>
                            <p className="text-[12px] text-[var(--color-text-secondary)]">
                                {new Date(largestExpenseValue.date).toLocaleDateString()} • {largestExpenseValue.note || 'Regular expense'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[20px] font-bold kavish-red">
                                {formatCurrency(largestExpenseValue.amount)}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
