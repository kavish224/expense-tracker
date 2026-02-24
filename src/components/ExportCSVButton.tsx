'use client';

import { useState, useRef, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useToast } from './Toast';
import Calendar from './Calendar';

const RANGE_OPTIONS = [
    { label: 'Current Month', value: 'current_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'Last 3 Months', value: 'last_3_months' },
    { label: 'All Time', value: 'all_time' },
    { label: 'Custom Range', value: 'custom_range' },
];

export default function ExportCSVButton() {
    const expenses = useExpenseStore((s) => s.expenses);
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [fromDate, setFromDate] = useState<Date | null>(null);
    const [toDate, setToDate] = useState<Date | null>(null);
    const [pickingFor, setPickingFor] = useState<'from' | 'to' | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowDatePicker(false);
                setPickingFor(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filterExpensesByRange = (range: string, customFrom?: Date | null, customTo?: Date | null) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        switch (range) {
            case 'current_month':
                return expenses.filter(e => {
                    const d = new Date(e.date);
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                });
            case 'last_month':
                const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
                const lmMonth = lastMonthDate.getMonth();
                const lmYear = lastMonthDate.getFullYear();
                return expenses.filter(e => {
                    const d = new Date(e.date);
                    return d.getMonth() === lmMonth && d.getFullYear() === lmYear;
                });
            case 'last_3_months':
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(now.getMonth() - 3);
                return expenses.filter(e => new Date(e.date) >= threeMonthsAgo);
            case 'custom_range':
                if (!customFrom || !customTo) return [];
                const start = new Date(customFrom);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customTo);
                end.setHours(23, 59, 59, 999);
                return expenses.filter(e => {
                    const d = new Date(e.date);
                    return d >= start && d <= end;
                });
            case 'all_time':
            default:
                return expenses;
        }
    };

    const handleExport = (range: string, label: string) => {
        if (range === 'custom_range' && !showDatePicker) {
            setShowDatePicker(true);
            return;
        }

        const filtered = filterExpensesByRange(range, fromDate, toDate);
        setIsOpen(false);
        setShowDatePicker(false);
        setPickingFor(null);

        if (!filtered || filtered.length === 0) {
            showToast(`No data found for ${label}`, 'error');
            return;
        }

        try {
            showToast(`Generating CSV for ${label}...`, 'info');

            const headers = ['Date', 'Category', 'Payment Method', 'Account', 'Amount', 'Note'];
            const rows = filtered.map(expense => [
                new Date(expense.date).toISOString().split('T')[0],
                expense.category,
                expense.paymentMethod,
                expense.accountName || '',
                expense.amount.toString(),
                `"${(expense.note || '').replace(/"/g, '""')}"`
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const filenameRange = range === 'custom_range'
                ? `${fromDate?.toISOString().split('T')[0]}_to_${toDate?.toISOString().split('T')[0]}`
                : range;
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `expenses_${filenameRange}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast(`Successfully exported ${filtered.length} transactions`, 'success');
        } catch (error) {
            showToast('Failed to export CSV', 'error');
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[#ff5722] hover:border-[#ff5722]/30 active:scale-95 transition-all shadow-sm"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export CSV
            </button>

            {isOpen && (
                <div className={`absolute right-0 top-full mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-2xl z-50 overflow-hidden kavish-slide-up origin-top-right transition-all ${showDatePicker ? 'w-72' : 'w-56'}`}>
                    {!showDatePicker ? (
                        <>
                            <div className="p-2 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold border-b border-[var(--color-border2)] bg-[var(--color-surface2)]/50">
                                Select Range
                            </div>
                            <div className="p-1">
                                {RANGE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleExport(opt.value, opt.label)}
                                        className="w-full text-left px-3 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface2)] hover:text-[#ff5722] rounded-md transition-all flex items-center justify-between group"
                                    >
                                        {opt.label}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="p-3">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Custom Range</span>
                                <button
                                    onClick={() => { setShowDatePicker(false); setPickingFor(null); }}
                                    className="p-1 rounded-full hover:bg-[var(--color-surface2)] text-[var(--color-text-secondary)]"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            {!pickingFor ? (
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-[var(--color-text-secondary)] uppercase mb-1 block">From</label>
                                            <button
                                                onClick={() => setPickingFor('from')}
                                                className={`w-full text-left p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface2)] text-[12px] font-medium transition-all ${!fromDate ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)] border-[#ff5722]/30'}`}
                                            >
                                                {formatDate(fromDate)}
                                            </button>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-[var(--color-text-secondary)] uppercase mb-1 block">To</label>
                                            <button
                                                onClick={() => setPickingFor('to')}
                                                className={`w-full text-left p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface2)] text-[12px] font-medium transition-all ${!toDate ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)] border-[#ff5722]/30'}`}
                                            >
                                                {formatDate(toDate)}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleExport('custom_range', 'Custom Range')}
                                        disabled={!fromDate || !toDate}
                                        className="w-full bg-[#ff5722] text-white py-2 rounded-md text-[13px] font-semibold hover:bg-[#e64a19] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.98]"
                                    >
                                        Generate CSV
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <button
                                            onClick={() => setPickingFor(null)}
                                            className="text-[var(--color-text-secondary)] hover:text-[#ff5722]"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="15 18 9 12 15 6" />
                                            </svg>
                                        </button>
                                        <span className="text-[12px] font-medium">Picking {pickingFor === 'from' ? 'Start' : 'End'} Date</span>
                                    </div>
                                    <Calendar
                                        selectedDate={pickingFor === 'from' ? fromDate : toDate}
                                        onSelect={(date) => {
                                            if (pickingFor === 'from') setFromDate(date);
                                            else setToDate(date);
                                            setPickingFor(null);
                                        }}
                                        className="!border-0 !shadow-none !p-0"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
