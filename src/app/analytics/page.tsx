'use client';

import { useExpenseStore } from '@/store/useExpenseStore';
import {
    getCategoryTotals,
    formatCurrency,
} from '@/lib/calculations';
import { CATEGORY_COLORS } from '@/lib/types';
import { useMemo, useState } from 'react';
import ExportCSVButton from '@/components/ExportCSVButton';
import LoadingSpinner from '@/components/LoadingSpinner';

const CATEGORY_EMOJI: Record<string, string> = {
    Food: '🍜', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
    Bills: '📋', Health: '💊', Education: '🎓', Travel: '✈️',
    Groceries: '🛒', Other: '💰',
};

export default function Analytics() {
    const { expenses, accounts, openEditModal, loading } = useExpenseStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterAccount, setFilterAccount] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showFilters, setShowFilters] = useState(false);

    const categoryTotals = useMemo(() => getCategoryTotals(expenses), [expenses]);
    const totalSpend = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

    const filteredExpenses = useMemo(() => {
        let result = [...expenses];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.category.toLowerCase().includes(q) ||
                (e.note && e.note.toLowerCase().includes(q)) ||
                (e.accountName && e.accountName.toLowerCase().includes(q))
            );
        }
        if (filterCategory !== 'All') result = result.filter(e => e.category === filterCategory);
        if (filterAccount !== 'All') result = result.filter(e => e.account === filterAccount);

        result.sort((a, b) => {
            if (sortBy === 'date') {
                const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
                return sortOrder === 'desc' ? diff : -diff;
            }
            return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
        });
        return result;
    }, [expenses, searchTerm, filterCategory, filterAccount, sortBy, sortOrder]);

    const groupedExpenses = useMemo(() => {
        if (sortBy === 'amount') {
            return [{ date: 'All Transactions', items: filteredExpenses, total: filteredExpenses.reduce((s, e) => s + e.amount, 0) }];
        }
        const groups: Record<string, { date: string; items: typeof expenses; total: number }> = {};
        filteredExpenses.forEach(e => {
            const key = new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            if (!groups[key]) groups[key] = { date: key, items: [], total: 0 };
            groups[key].items.push(e);
            groups[key].total += e.amount;
        });
        return Object.values(groups);
    }, [filteredExpenses, sortBy]);

    const categories = useMemo(() => Array.from(new Set(expenses.map(e => e.category))), [expenses]);
    if (loading.initial) {
        return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
    }
    return (
        <main className="mx-auto max-w-lg px-4 pt-5 pb-8 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-[22px] font-bold text-(--color-text-primary) tracking-tight">Analytics</h2>
                <ExportCSVButton />
            </div>

            {/* Category summary — horizontal scroll pills */}
            {categoryTotals.length > 0 && (
                <div>
                    <p className="text-[13px] font-semibold text-(--color-text-secondary) uppercase tracking-wide px-1 mb-2">Top Categories</p>
                    <div className="kavish-card divide-y divide-(--color-border2)">
                        {categoryTotals.map((cat) => {
                            const pct = totalSpend > 0 ? (cat.value / totalSpend) * 100 : 0;
                            return (
                                <div key={cat.name} className="kavish-row" onClick={() => setFilterCategory(filterCategory === cat.name ? 'All' : cat.name)}>
                                    <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[17px] shrink-0 mr-3" style={{ backgroundColor: `${CATEGORY_COLORS[cat.name as keyof typeof CATEGORY_COLORS]}20` }}>
                                        {CATEGORY_EMOJI[cat.name] ?? '💰'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[15px] font-medium ${filterCategory === cat.name ? 'text-(--color-accent)' : 'text-(--color-text-primary)'}`}>{cat.name}</span>
                                            <span className="text-[15px] font-medium text-(--color-text-primary) ml-4">{formatCurrency(cat.value)}</span>
                                        </div>
                                        <div className="h-1 rounded-full bg-(--color-surface3) overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat.name as keyof typeof CATEGORY_COLORS] || 'var(--color-accent)' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Search + Filter row */}
            <div className="space-y-3">
                <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-muted)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search expenses…"
                        className="w-full h-10 bg-(--color-surface) rounded-[10px] pl-9 pr-4 text-[15px] text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none border border-(--color-border2) focus:border-(--color-accent) transition-colors"
                    />
                </div>

                {/* Sort + Filter controls */}
                <div className="flex items-center gap-2">
                    {/* Segmented sort control */}
                    <div className="flex bg-(--color-surface) border border-(--color-border2) rounded-[10px] p-0.5 gap-0.5">
                        <button
                            onClick={() => { setSortBy('date'); setSortOrder('desc'); }}
                            className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all ${sortBy === 'date' ? 'bg-(--color-accent) text-white' : 'text-(--color-text-secondary)'}`}
                        >
                            Date
                        </button>
                        <button
                            onClick={() => { setSortBy('amount'); setSortOrder('desc'); }}
                            className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all ${sortBy === 'amount' ? 'bg-(--color-accent) text-white' : 'text-(--color-text-secondary)'}`}
                        >
                            Amount
                        </button>
                    </div>

                    {/* Order toggle */}
                    <button
                        onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                        className="h-9 w-9 flex items-center justify-center bg-(--color-surface) border border-(--color-border2) rounded-[10px] text-(--color-text-secondary) active:bg-(--color-surface2) transition-colors"
                        aria-label="Toggle sort order"
                    >
                        <svg className={`transition-transform duration-200 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {/* Filter button */}
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-1.5 h-9 px-3 rounded-[10px] border text-[13px] font-medium transition-all ${showFilters ? 'bg-(--color-accent) border-(--color-accent) text-white' : 'bg-(--color-surface) border-(--color-border2) text-(--color-text-secondary)'}`}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        Filter
                    </button>

                    <span className="ml-auto text-[13px] text-(--color-text-muted)">{filteredExpenses.length} items</span>
                </div>

                {/* Filter drawer */}
                {showFilters && (
                    <div className="kavish-card p-4 space-y-3 ios-fade-in">
                        <div>
                            <p className="text-[11px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Category</p>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setFilterCategory('All')} className={`kavish-chip ${filterCategory === 'All' ? 'active' : ''}`}>All</button>
                                {categories.map(cat => (
                                    <button key={cat} onClick={() => setFilterCategory(cat)} className={`kavish-chip ${filterCategory === cat ? 'active' : ''}`}>{cat}</button>
                                ))}
                            </div>
                        </div>
                        {accounts.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Account</p>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setFilterAccount('All')} className={`kavish-chip ${filterAccount === 'All' ? 'active' : ''}`}>All</button>
                                    {accounts.map(acc => (
                                        <button key={acc.id} onClick={() => setFilterAccount(acc.id)} className={`kavish-chip ${filterAccount === acc.id ? 'active' : ''}`}>{acc.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {(filterCategory !== 'All' || filterAccount !== 'All' || searchTerm) && (
                            <button
                                onClick={() => { setFilterCategory('All'); setFilterAccount('All'); setSearchTerm(''); }}
                                className="text-[13px] text-(--color-accent) font-medium"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Transaction list */}
            <div className="space-y-6 pb-4">
                {groupedExpenses.length > 0 ? (
                    groupedExpenses.map(group => (
                        <div key={group.date}>
                            <div className="flex items-center justify-between px-1 mb-2">
                                <p className="text-[13px] font-semibold text-(--color-text-secondary) uppercase tracking-wide">{group.date}</p>
                                <p className="text-[13px] font-medium text-(--color-text-secondary)">{formatCurrency(group.total)}</p>
                            </div>
                            <div className="kavish-card divide-y divide-(--color-border2)">
                                {group.items.map(expense => (
                                    <div
                                        key={expense.id}
                                        className="kavish-row active:bg-(--color-surface2) cursor-pointer"
                                        onClick={() => openEditModal(expense)}
                                    >
                                        <div className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[18px] shrink-0 mr-3" style={{ backgroundColor: `${CATEGORY_COLORS[expense.category as keyof typeof CATEGORY_COLORS]}20` }}>
                                            {CATEGORY_EMOJI[expense.category] ?? '💰'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] font-medium text-(--color-text-primary) truncate">{expense.category}</p>
                                            <p className="text-[13px] text-(--color-text-secondary) truncate">
                                                {expense.note || expense.paymentMethod}
                                                {expense.accountName ? ` · ${expense.accountName}` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right ml-3 shrink-0">
                                            <p className="text-[15px] font-medium text-(--color-text-primary)">₹{expense.amount.toLocaleString('en-IN')}</p>
                                            <p className="text-[12px] text-(--color-text-muted)">
                                                {new Date(expense.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-16 flex flex-col items-center gap-3 text-center">
                        <div className="w-14 h-14 rounded-full bg-(--color-surface2) flex items-center justify-center text-(--color-text-muted)">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[16px] font-semibold text-(--color-text-primary)">No results</p>
                            <p className="text-[14px] text-(--color-text-secondary) mt-0.5">Try adjusting your filters</p>
                        </div>
                        <button
                            onClick={() => { setSearchTerm(''); setFilterCategory('All'); setFilterAccount('All'); }}
                            className="text-[14px] font-medium text-(--color-accent)"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
