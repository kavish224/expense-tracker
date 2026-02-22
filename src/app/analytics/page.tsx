'use client';

import { useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import {
    getMonthlyTrend,
    getCategoryTotals,
    getDailyAverage,
    getLargestExpense,
    getMonthOverMonthChange,
    formatCurrency,
} from '@/lib/calculations';
import { CATEGORY_COLORS } from '@/lib/types';
import DashboardCard from '@/components/DashboardCard';
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

export default function AnalyticsPage() {
    const { expenses, isLoaded } = useExpenseStore();

    const monthlyTrend = useMemo(() => getMonthlyTrend(expenses, 6), [expenses]);
    const categoryTotals = useMemo(() => getCategoryTotals(expenses), [expenses]);
    const dailyAvg = useMemo(() => getDailyAverage(expenses), [expenses]);
    const largest = useMemo(() => getLargestExpense(expenses), [expenses]);
    const mom = useMemo(() => getMonthOverMonthChange(expenses), [expenses]);

    if (!isLoaded) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-4">
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
                <DashboardCard title="Daily Average">
                    <p className="text-xl font-bold text-gray-800 dark:text-white">
                        {formatCurrency(dailyAvg)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        This month
                    </p>
                </DashboardCard>
                <DashboardCard title="Month over Month">
                    <p className="text-xl font-bold text-gray-800 dark:text-white">
                        {mom.changePercent > 0 ? '+' : ''}
                        {mom.changePercent.toFixed(1)}%
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        vs last month
                    </p>
                </DashboardCard>
            </div>

            {/* Largest expense */}
            {largest && (
                <DashboardCard title="Largest This Month">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{
                                backgroundColor:
                                    CATEGORY_COLORS[largest.category] || '#AEB6BF',
                            }}
                        >
                            {largest.category.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-800 dark:text-white">
                                {formatCurrency(largest.amount)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {largest.category}
                                {largest.note && ` · ${largest.note}`}
                            </p>
                        </div>
                    </div>
                </DashboardCard>
            )}

            {/* Monthly trend */}
            <DashboardCard title="Monthly Trend">
                {monthlyTrend.every((m) => m.total === 0) ? (
                    <p className="py-8 text-center text-sm text-gray-500">
                        No data yet
                    </p>
                ) : (
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyTrend}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#374151"
                                    opacity={0.3}
                                />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                    width={45}
                                />
                                <Tooltip
                                    formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                                    contentStyle={{
                                        backgroundColor: '#1e2235',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    labelStyle={{ color: '#9CA3AF' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#3B82F6"
                                    strokeWidth={2.5}
                                    dot={{ r: 4, fill: '#3B82F6' }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </DashboardCard>

            {/* Category bar chart */}
            {categoryTotals.length > 0 && (
                <DashboardCard title="Spending by Category">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryTotals} layout="vertical">
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    horizontal={false}
                                    stroke="#374151"
                                    opacity={0.3}
                                />
                                <XAxis
                                    type="number"
                                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={80}
                                />
                                <Tooltip
                                    formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                                    contentStyle={{
                                        backgroundColor: '#1e2235',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {categoryTotals.map((entry) => (
                                        <Cell
                                            key={entry.name}
                                            fill={CATEGORY_COLORS[entry.name] || '#AEB6BF'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            )}

            {/* Comparison card */}
            <DashboardCard title="Month Comparison">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            This Month
                        </p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                            {formatCurrency(mom.current)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Last Month
                        </p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                            {formatCurrency(mom.previous)}
                        </p>
                    </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700/50 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{
                            width:
                                mom.previous === 0
                                    ? '100%'
                                    : `${Math.min(
                                        (mom.current / mom.previous) * 100,
                                        100
                                    )}%`,
                        }}
                    />
                </div>
            </DashboardCard>
        </div>
    );
}
