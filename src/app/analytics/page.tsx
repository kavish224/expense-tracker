'use client';

import { useExpenseStore } from '@/store/useExpenseStore';
import DashboardCard from '@/components/DashboardCard';
import {
    getCategoryTotals,
    getMonthlyTrend,
    getDailyAverage,
    getLargestExpense,
    getMonthOverMonthChange,
    getAccountSpendingByType,
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
import { useMemo, useState } from 'react';
import ExportCSVButton from '@/components/ExportCSVButton';

export default function Analytics() {
    const { expenses, accounts, openEditModal } = useExpenseStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showFilters, setShowFilters] = useState(false);

    const monthlyTrend = useMemo(() => getMonthlyTrend(expenses), [expenses]);
    const categoryTotals = useMemo(() => getCategoryTotals(expenses), [expenses]);
    const dailyAverage = useMemo(() => getDailyAverage(expenses), [expenses]);
    const largestExpenseValue = useMemo(() => getLargestExpense(expenses), [expenses]);
    const momChangeData = useMemo(() => getMonthOverMonthChange(expenses), [expenses]);
    const bankSpending = useMemo(() => getAccountSpendingByType(expenses, accounts, 'Bank'), [expenses, accounts]);
    const creditCardSpending = useMemo(() => getAccountSpendingByType(expenses, accounts, 'CreditCard'), [expenses, accounts]);

    const filteredExpenses = useMemo(() => {
        let result = [...expenses];

        // Search
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.category.toLowerCase().includes(lowSearch) ||
                (e.note && e.note.toLowerCase().includes(lowSearch)) ||
                (e.accountName && e.accountName.toLowerCase().includes(lowSearch))
            );
        }

        // Category Filter
        if (filterCategory !== 'All') {
            result = result.filter(e => e.category === filterCategory);
        }

        // Payment Method Filter
        if (filterPaymentMethod !== 'All') {
            result = result.filter(e => e.paymentMethod === filterPaymentMethod);
        }

        // Sorting
        result.sort((a, b) => {
            if (sortBy === 'date') {
                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
            } else {
                return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
            }
        });

        return result;
    }, [expenses, searchTerm, filterCategory, filterPaymentMethod, sortBy, sortOrder]);

    return (
        <main className="mx-auto max-w-lg px-4 py-6 space-y-6 pb-24">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-[18px] font-bold text-[var(--color-text-primary)]">Analytics</h2>
                <ExportCSVButton />
            </div>

            {/* Analytics Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="kavish-card p-4 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg)]">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-bold mb-1 opacity-80">
                        Daily Avg
                    </p>
                    <p className="text-[22px] font-black text-[var(--color-text-primary)]">
                        {formatCurrency(dailyAverage)}
                    </p>
                </div>
                <div className="kavish-card p-4 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg)]">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-bold mb-1 opacity-80">
                        MoM Change
                    </p>
                    <p className={`text-[22px] font-black ${momChangeData.change >= 0 ? 'kavish-red' : 'kavish-green'}`}>
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
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                }}
                                itemStyle={{ color: 'var(--color-text-primary)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="total"
                                stroke="var(--color-accent)"
                                strokeWidth={3}
                                dot={{ fill: 'var(--color-accent)', r: 4, strokeWidth: 0 }}
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
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                    }}
                                    itemStyle={{ color: 'var(--color-text-primary)' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {categoryTotals.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || 'var(--color-accent)'}
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

            {/* Per Bank Account Spend */}
            <DashboardCard title="By Bank Account">
                <div className="h-48 w-full">
                    {bankSpending.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bankSpending} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border2)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-text-primary)', fontSize: 12 }}
                                    width={100}
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
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} fill="#4caf50" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)] text-[13px]">
                            No bank account spending data
                        </div>
                    )}
                </div>
            </DashboardCard>

            {/* Per Credit Card Spend */}
            <DashboardCard title="By Credit Card">
                <div className="h-48 w-full">
                    {creditCardSpending.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={creditCardSpending} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border2)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-text-primary)', fontSize: 12 }}
                                    width={100}
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
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} fill="#2196f3" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)] text-[13px]">
                            No credit card spending data
                        </div>
                    )}
                </div>
            </DashboardCard>

            {/* Expense Explorer */}
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[15px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Expense Explorer</h3>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-lg transition-all ${showFilters ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface2)] text-[var(--color-text-secondary)]'}`}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                    </button>
                </div>

                {/* Filter Controls */}
                {showFilters && (
                    <div className="kavish-card p-4 space-y-4 bg-[var(--color-surface2)] transition-all animate-in fade-in slide-in-from-top-4">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by note, category or account..."
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-10 pr-4 py-2 text-[13px] outline-none focus:border-[var(--color-accent)]"
                            />
                            <svg className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-1 block">Category</label>
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[13px] outline-none"
                                >
                                    <option value="All">All Categories</option>
                                    {Object.keys(CATEGORY_COLORS).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-1 block">Sort By</label>
                                <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setSortBy('date')}
                                        className={`flex-1 py-1.5 text-[11px] font-bold ${sortBy === 'date' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}
                                    >
                                        Date
                                    </button>
                                    <button
                                        onClick={() => setSortBy('amount')}
                                        className={`flex-1 py-1.5 text-[11px] font-bold ${sortBy === 'amount' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}
                                    >
                                        Amount
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl py-2 text-[12px] font-bold text-[var(--color-text-primary)] flex items-center justify-center gap-2"
                            >
                                {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sortOrder === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterCategory('All');
                                    setFilterPaymentMethod('All');
                                    setSortBy('date');
                                    setSortOrder('desc');
                                }}
                                className="px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[12px] font-bold text-[var(--color-text-muted)]"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}

                {/* Explorer List */}
                <div className="kavish-card overflow-hidden">
                    {filteredExpenses.length > 0 ? (
                        <div className="divide-y divide-[var(--color-border2)]">
                            {filteredExpenses.map((expense) => (
                                <div
                                    key={expense.id}
                                    onClick={() => openEditModal(expense)}
                                    className="kavish-row hover:bg-[var(--color-surface2)] active:bg-[var(--color-surface2)] transition-colors group cursor-pointer"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-bold text-[13px] text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                                                {expense.category}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-surface2)] text-[var(--color-text-muted)] rounded font-bold uppercase tracking-wider">
                                                {expense.paymentMethod}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-[var(--color-text-secondary)] flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                                            <span className="font-semibold">
                                                {new Date(expense.date).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                            <span className="text-[var(--color-text-muted)]">•</span>
                                            <span>
                                                {expense.accountName || 'No account'}
                                            </span>
                                            {expense.note && (
                                                <>
                                                    <span className="text-[var(--color-text-muted)]">•</span>
                                                    <span className="italic truncate max-w-[150px]">{expense.note}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-[15px] font-black ${expense.amount > 1000 ? 'kavish-red' : 'kavish-green'}`}>
                                            ₹{expense.amount.toLocaleString('en-IN')}
                                        </p>
                                        <p className="text-[10px] text-[var(--color-text-muted)] font-medium">
                                            {new Date(expense.date).toLocaleTimeString('en-IN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center space-y-2">
                            <div className="text-[var(--color-text-muted)] opacity-20 flex justify-center">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <p className="text-[13px] text-[var(--color-text-secondary)] font-medium">No transactions match your search</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
