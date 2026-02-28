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
    const [filterAccount, setFilterAccount] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showFilters, setShowFilters] = useState(false);

    const monthlyTrend = useMemo(() => getMonthlyTrend(expenses), [expenses]);
    const categoryTotals = useMemo(() => getCategoryTotals(expenses), [expenses]);
    const dailyAverage = useMemo(() => getDailyAverage(expenses), [expenses]);
    const momChangeData = useMemo(() => getMonthOverMonthChange(expenses), [expenses]);
    const bankSpending = useMemo(() => getAccountSpendingByType(expenses, accounts, 'Bank'), [expenses, accounts]);
    const creditCardSpending = useMemo(() => getAccountSpendingByType(expenses, accounts, 'CreditCard'), [expenses, accounts]);

    const filteredExpenses = useMemo(() => {
        let result = [...expenses];
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.category.toLowerCase().includes(lowSearch) ||
                (e.note && e.note.toLowerCase().includes(lowSearch)) ||
                (e.accountName && e.accountName.toLowerCase().includes(lowSearch))
            );
        }
        if (filterCategory !== 'All') result = result.filter(e => e.category === filterCategory);
        if (filterPaymentMethod !== 'All') result = result.filter(e => e.paymentMethod === filterPaymentMethod);
        if (filterAccount !== 'All') result = result.filter(e => e.account === filterAccount);

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
    }, [expenses, searchTerm, filterCategory, filterPaymentMethod, filterAccount, sortBy, sortOrder]);

    const groupedExpenses = useMemo(() => {
        if (sortBy === 'amount') {
            return [{
                date: 'All Transactions',
                items: filteredExpenses,
                total: filteredExpenses.reduce((s, e) => s + e.amount, 0),
                isFlat: true
            }];
        }

        const groups: { [key: string]: { date: string, items: typeof expenses, total: number, isFlat?: boolean } } = {};
        filteredExpenses.forEach(e => {
            const dateObj = new Date(e.date);
            const key = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            if (!groups[key]) {
                groups[key] = { date: key, items: [], total: 0 };
            }
            groups[key].items.push(e);
            groups[key].total += e.amount;
        });
        return Object.values(groups);
    }, [filteredExpenses, sortBy]);

    return (
        <main className="mx-auto max-w-lg px-4 py-6 space-y-6 pb-6">
            <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-black text-[var(--color-text-primary)] tracking-tight">Analytics</h2>
                <ExportCSVButton />
            </div>

            {/* Expense Explorer - The Main Highlight */}
            <div className="pt-4 space-y-5">
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Explorer</h3>
                        <div className="text-[11px] font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-full">
                            {filteredExpenses.length} Transactions
                        </div>
                    </div>

                    {/* Modern Search & Search Chips */}
                    <div className="space-y-3">
                        <div className="relative group">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search note, category, account..."
                                className="w-full h-11 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-2xl pl-11 pr-4 text-[13px] font-medium outline-none focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] transition-all shadow-sm"
                            />
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>

                        {/* Scrolling Category Chips */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                            <button
                                onClick={() => setFilterCategory('All')}
                                className={`flex-none px-4 py-2 rounded-full text-[11px] font-black transition-all border ${filterCategory === 'All' ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20' : 'bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'}`}
                            >
                                ALL
                            </button>
                            {Object.keys(CATEGORY_COLORS).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(cat)}
                                    className={`flex-none px-4 py-2 rounded-full text-[11px] font-black transition-all border ${filterCategory === cat ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20' : 'bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'}`}
                                >
                                    {cat.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Filter Summary / Quick Actions */}
                <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] shadow-sm transition-all ${showFilters ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/5 border-[var(--color-accent)]' : 'bg-[var(--color-surface2)]'}`}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                            REFINE
                        </button>
                        <div className="flex items-center bg-[var(--color-surface2)] rounded-xl border border-[var(--color-border)] p-0.5 shadow-sm">
                            <button
                                onClick={() => { setSortBy('date'); setSortOrder('desc'); }}
                                className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'date' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                            >
                                DATE
                            </button>
                            <button
                                onClick={() => { setSortBy('amount'); setSortOrder('desc'); }}
                                className={`px-2.5 py-1 rounded-lg transition-all ${sortBy === 'amount' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                            >
                                AMOUNT
                            </button>
                        </div>
                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-text-muted)] transition-all"
                        >
                            {sortBy === 'date'
                                ? (sortOrder === 'desc' ? 'NEWEST' : 'OLDEST')
                                : (sortOrder === 'desc' ? 'HIGHEST' : 'LOWEST')
                            }
                            <svg className={`transition-transform duration-300 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div className="hidden sm:block">
                        <span className="opacity-60">NET:</span> {formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
                    </div>
                </div>

                {/* Extended Filters Drawer */}
                {showFilters && (
                    <div className="kavish-card p-4 space-y-4 bg-[var(--color-surface2)] border-dashed animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Payment Method</label>
                                <select
                                    value={filterPaymentMethod}
                                    onChange={(e) => { setFilterPaymentMethod(e.target.value); setFilterAccount('All'); }}
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[12px] font-bold outline-none focus:border-[var(--color-accent)]"
                                >
                                    <option value="All">All Methods</option>
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Credit Card">Credit Card</option>
                                    <option value="Debit Card">Debit Card</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Sort Metric</label>
                                <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden p-0.5">
                                    <button onClick={() => setSortBy('date')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${sortBy === 'date' ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-secondary)]'}`}>DATE</button>
                                    <button onClick={() => setSortBy('amount')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${sortBy === 'amount' ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-secondary)]'}`}>AMOUNT</button>
                                </div>
                            </div>
                        </div>

                        {filterPaymentMethod !== 'Cash' && filterPaymentMethod !== 'Wallet' && (
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Specific Account</label>
                                <select
                                    value={filterAccount}
                                    onChange={(e) => setFilterAccount(e.target.value)}
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[12px] font-bold outline-none focus:border-[var(--color-accent)]"
                                >
                                    <option value="All">All {filterPaymentMethod} Accounts</option>
                                    {accounts.filter(a => (filterPaymentMethod === 'Credit Card' ? a.type === 'CreditCard' : a.type === 'Bank')).map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {/* Grouped Transaction List */}
                <div className="space-y-8 pb-10">
                    {groupedExpenses.length > 0 ? (
                        groupedExpenses.map((group) => (
                            <div key={group.date} className="space-y-3">
                                <div className="flex items-center justify-between sticky top-0 py-1 bg-(--color-bg) z-10">
                                    <h4 className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.1em]">
                                        {sortBy === 'amount' ? 'All Transactions' : group.date}
                                    </h4>
                                    {!group.isFlat && (
                                        <span className="text-[11px] font-black text-[var(--color-text-secondary)] bg-[var(--color-surface2)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                                            {formatCurrency(group.total)}
                                        </span>
                                    )}
                                </div>
                                <div className="kavish-card overflow-hidden divide-y divide-[var(--color-border2)]/50">
                                    {group.items.map((expense) => (
                                        <div
                                            key={expense.id}
                                            onClick={() => openEditModal(expense)}
                                            className="flex items-center gap-4 p-4 hover:bg-[var(--color-surface2)] active:scale-[0.99] transition-all cursor-pointer group"
                                        >
                                            {/* Category Icon Circle */}
                                            <div
                                                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: `${CATEGORY_COLORS[expense.category as keyof typeof CATEGORY_COLORS]}20`, border: `1.5px solid ${CATEGORY_COLORS[expense.category as keyof typeof CATEGORY_COLORS]}40` }}
                                            >
                                                <div style={{ color: CATEGORY_COLORS[expense.category as keyof typeof CATEGORY_COLORS] }}>
                                                    <CategoryIcon category={expense.category} size={18} />
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-bold text-[14px] text-[var(--color-text-primary)] truncate">{expense.category}</span>
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-[var(--color-surface2)] text-[var(--color-text-muted)] rounded-md font-black uppercase tracking-wider border border-[var(--color-border)]">
                                                        {expense.paymentMethod}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] font-medium">
                                                    <span className="truncate">{expense.note || 'Regular expense'}</span>
                                                    {expense.accountName && (
                                                        <>
                                                            <span className="text-[var(--color-text-muted)] opacity-50">•</span>
                                                            <span className="text-[var(--color-accent)] font-bold">{expense.accountName}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className={`text-[16px] font-black tracking-tight ${expense.amount > 1000 ? 'text-[var(--color-red)]' : 'text-[var(--color-text-primary)]'}`}>
                                                    ₹{expense.amount.toLocaleString('en-IN')}
                                                </p>
                                                <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-tighter opacity-60">
                                                    {new Date(expense.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-[var(--color-surface2)] rounded-full flex items-center justify-center mx-auto text-[var(--color-text-muted)] opacity-30 animate-pulse">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[15px] font-black text-[var(--color-text-primary)]">No Matches Found</p>
                                <p className="text-[12px] text-[var(--color-text-secondary)] font-medium px-10">Adjust your filters or try a different search term to explore your records.</p>
                            </div>
                            <button
                                onClick={() => { setSearchTerm(''); setFilterCategory('All'); setFilterPaymentMethod('All'); setFilterAccount('All'); }}
                                className="text-[11px] font-black text-[var(--color-accent)] uppercase tracking-widest hover:underline"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

function CategoryIcon({ category, size = 16 }: { category: string, size?: number }) {
    const props = { width: size, height: size, strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none", stroke: "currentColor" };
    switch (category) {
        case 'Food': return (
            <svg {...props} viewBox="0 0 24 24">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
        );
        case 'Transport': return (
            <svg {...props} viewBox="0 0 24 24">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
            </svg>
        );
        case 'Shopping': return (
            <svg {...props} viewBox="0 0 24 24">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        );
        case 'Entertainment': return (
            <svg {...props} viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="17" x2="22" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
        );
        case 'Bills': return (
            <svg {...props} viewBox="0 0 24 24">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M7 11h10" />
                <path d="M7 15h10" />
                <path d="M7 19h7" />
            </svg>
        );
        case 'Health': return (
            <svg {...props} viewBox="0 0 24 24">
                <path d="m22 12-4-4v3H9.89l3.3-3.3L11 2.5 4.5 9H2v6h2.5L11 21.5l2.19-2.19-3.3-3.31H18v3l4-4Z" />
            </svg>
        );
        case 'Education': return (
            <svg {...props} viewBox="0 0 24 24">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
            </svg>
        );
        case 'Travel': return (
            <svg {...props} viewBox="0 0 24 24">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
        );
        case 'Groceries': return (
            <svg {...props} viewBox="0 0 24 24">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
        );
        default: return (
            <svg {...props} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        );
    }
}
