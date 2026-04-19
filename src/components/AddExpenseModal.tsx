'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { CATEGORIES, PAYMENT_METHODS, ExpenseCategory, ExpenseInput, PaymentMethod } from '@/lib/types';
import { useToast } from './Toast';
import Calendar from './Calendar';
import TimePicker from './TimePicker';

type EntryMode = 'single' | 'bulk';

interface BulkExpenseDraft {
    id: string;
    amount: string;
    note?: string;
    category: ExpenseCategory;
    paymentMethod: PaymentMethod;
    account: string;
}

const MAX_BULK_EXPENSES = 50;
function isAccountRequiredForPayment(method: PaymentMethod): boolean {
    return ['UPI', 'Debit Card', 'Net Banking', 'Credit Card'].includes(method);
}

function createBulkDraft(): BulkExpenseDraft {
    return {
        id: `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        amount: '',
        note: '',
        category: CATEGORIES[0],
        paymentMethod: PAYMENT_METHODS[0],
        account: '',
    };
}

export default function AddExpenseModal() {
    const {
        isModalOpen,
        closeModal,
        addExpense,
        addExpensesBulk,
        updateExpense,
        deleteExpense,
        accounts,
        editingExpense,
    } = useExpenseStore();
    const { showToast } = useToast();

    const [entryMode, setEntryMode] = useState<EntryMode>('single');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>(CATEGORIES[0]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]);
    const [account, setAccount] = useState('');
    const [note, setNote] = useState('');
    const [bulkRows, setBulkRows] = useState<BulkExpenseDraft[]>([createBulkDraft()]);
    const [date, setDate] = useState(new Date().toISOString());
    const [showCalendar, setShowCalendar] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const singleNoteRef = useRef<HTMLInputElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    const [dragStartY, setDragStartY] = useState<number | null>(null);
    const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
    const isDragging = useRef(false);
    const translateY = dragCurrentY !== null && dragStartY !== null
        ? Math.max(0, dragCurrentY - dragStartY)
        : 0;

    const [viewportOffset, setViewportOffset] = useState(0);
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const onResize = () => {
            setViewportOffset(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)));
        };
        vv.addEventListener('resize', onResize);
        vv.addEventListener('scroll', onResize);
        return () => {
            vv.removeEventListener('resize', onResize);
            vv.removeEventListener('scroll', onResize);
        };
    }, []);

    const getAccountOptionsForPayment = useCallback((method: PaymentMethod) => {
        if (['UPI', 'Debit Card', 'Net Banking'].includes(method)) return accounts.filter((item) => item.type === 'Bank');
        if (method === 'Credit Card') return accounts.filter((item) => item.type === 'CreditCard');
        return [];
    }, [accounts]);

    const filteredAccounts = useMemo(() => {
        if (['UPI', 'Debit Card', 'Net Banking'].includes(paymentMethod)) return accounts.filter((item) => item.type === 'Bank');
        if (paymentMethod === 'Credit Card') return accounts.filter((item) => item.type === 'CreditCard');
        return [];
    }, [accounts, paymentMethod]);

    const selectedAccount = useMemo(() => {
        if (editingExpense && isModalOpen) return account;
        if (filteredAccounts.length === 0) return '';
        return filteredAccounts.some((item) => item.id === account) ? account : filteredAccounts[0].id;
    }, [account, editingExpense, filteredAccounts, isModalOpen]);

    const bulkState = useMemo(() => {
        const items: Array<{
            rowId: string;
            amount: number;
            note?: string;
            category: ExpenseCategory;
            paymentMethod: PaymentMethod;
            account?: string;
        }> = [];
        const errors: string[] = [];

        bulkRows.forEach((row, index) => {
            const lineNumber = index + 1;
            const amountText = row.amount.trim();
            const noteText = row.note?.trim() || '';
            if (!amountText && !noteText) return;

            const parsedAmount = Number(amountText);
            if (!isFinite(parsedAmount) || parsedAmount <= 0) {
                errors.push(`Row ${lineNumber}: amount must be positive`);
                return;
            }
            if (parsedAmount > 10_000_000) {
                errors.push(`Row ${lineNumber}: amount is too large`);
                return;
            }
            if (noteText.length > 200) {
                errors.push(`Row ${lineNumber}: description is too long`);
                return;
            }

            items.push({
                ...(isAccountRequiredForPayment(row.paymentMethod) && getAccountOptionsForPayment(row.paymentMethod).length === 0
                    ? (() => {
                        errors.push(`Row ${lineNumber}: add a ${row.paymentMethod === 'Credit Card' ? 'Credit Card' : 'Bank'} account first`);
                        return {};
                    })()
                    : {}),
                rowId: row.id,
                amount: parsedAmount,
                note: noteText || undefined,
                category: row.category,
                paymentMethod: row.paymentMethod,
                account: (() => {
                    const rowAccounts = getAccountOptionsForPayment(row.paymentMethod);
                    if (rowAccounts.length === 0) return undefined;
                    return rowAccounts.some((item) => item.id === row.account)
                        ? row.account
                        : rowAccounts[0].id;
                })(),
            });
        });

        if (items.length > MAX_BULK_EXPENSES) {
            errors.unshift(`You can add up to ${MAX_BULK_EXPENSES} expenses at once`);
        }

        return {
            items,
            errors,
            total: items.reduce((sum, item) => sum + item.amount, 0),
        };
    }, [bulkRows, getAccountOptionsForPayment]);

    const bulkExpenses = useMemo<ExpenseInput[]>(() => {
        const baseTime = new Date(date).getTime();
        return bulkState.items.map((item, index) => ({
            amount: item.amount,
            category: item.category,
            paymentMethod: item.paymentMethod,
            account: item.account,
            date: new Date(baseTime - index * 1000).toISOString(),
            note: item.note,
        }));
    }, [bulkState.items, date]);

    useEffect(() => {
        if (!isModalOpen) return;

        const frame = window.requestAnimationFrame(() => {
            if (editingExpense) {
                setEntryMode('single');
                setAmount(editingExpense.amount.toString());
                setCategory(editingExpense.category);
                setPaymentMethod(editingExpense.paymentMethod);
                setAccount(editingExpense.account || '');
                setNote(editingExpense.note || '');
                setBulkRows([createBulkDraft()]);
                setDate(editingExpense.date);
            } else {
                setEntryMode('single');
                setAmount('');
                setCategory(CATEGORIES[0]);
                setPaymentMethod(PAYMENT_METHODS[0]);
                setAccount('');
                setNote('');
                setBulkRows([createBulkDraft()]);
                setDate(new Date().toISOString());
            }

            setShowCalendar(false);
            setShowTimePicker(false);
            setSubmitting(false);
            setConfirmDelete(false);
            setDragStartY(null);
            setDragCurrentY(null);
            setViewportOffset(0);
            isDragging.current = false;
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isModalOpen, editingExpense]);

    useEffect(() => {
        const container = document.getElementById('scroll-container');
        if (isModalOpen && container) {
            container.style.overflow = 'hidden';
        } else if (container) {
            container.style.overflow = '';
        }

        return () => {
            if (container) container.style.overflow = '';
        };
    }, [isModalOpen]);

    const handleClose = useCallback(() => {
        setShowCalendar(false);
        setShowTimePicker(false);
        setDragStartY(null);
        setDragCurrentY(null);
        setViewportOffset(0);
        setSubmitting(false);
        setConfirmDelete(false);
        isDragging.current = false;
        closeModal();
    }, [closeModal]);

    const handleSave = useCallback(async () => {
        if (submitting) return;

        if (editingExpense) {
            const parsed = parseFloat(amount);
            if (isNaN(parsed) || parsed <= 0) return;

            setSubmitting(true);
            try {
                await updateExpense(editingExpense.id, {
                    amount: parsed,
                    category,
                    paymentMethod,
                    account: selectedAccount || undefined,
                    date,
                    note: note.trim() || undefined,
                });
                showToast('Expense updated', 'success');
                handleClose();
            } catch {
                showToast('Something went wrong. Please try again.', 'error');
                setSubmitting(false);
            }
            return;
        }

        if (entryMode === 'bulk') {
            if (bulkState.errors.length > 0) {
                showToast(bulkState.errors[0], 'error');
                return;
            }
            if (bulkExpenses.length === 0) {
                showToast('Add at least one line to continue', 'error');
                return;
            }

            setSubmitting(true);
            try {
                await addExpensesBulk(bulkExpenses);
                showToast(`${bulkExpenses.length} expenses added`, 'success');
                handleClose();
            } catch {
                showToast('Something went wrong. Please try again.', 'error');
                setSubmitting(false);
            }
            return;
        }

        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return;

        setSubmitting(true);

        try {
            await addExpense({
                amount: parsed,
                category,
                paymentMethod,
                account: selectedAccount || undefined,
                date,
                note: note.trim() || undefined,
            });
            showToast('Expense added', 'success');
            handleClose();
        } catch {
            showToast('Something went wrong. Please try again.', 'error');
            setSubmitting(false);
        }
    }, [
        submitting,
        editingExpense,
        amount,
        updateExpense,
        category,
        paymentMethod,
        selectedAccount,
        date,
        note,
        showToast,
        handleClose,
        entryMode,
        bulkState.errors,
        bulkExpenses,
        addExpensesBulk,
        addExpense,
    ]);

    const handleDelete = useCallback(async () => {
        if (!editingExpense || submitting) return;
        setSubmitting(true);
        try {
            await deleteExpense(editingExpense.id);
            showToast('Expense deleted', 'success');
            handleClose();
        } catch {
            showToast('Failed to delete. Please try again.', 'error');
            setSubmitting(false);
            setConfirmDelete(false);
        }
    }, [editingExpense, deleteExpense, handleClose, showToast, submitting]);

    const handleKeypadPress = useCallback((key: string) => {
        singleNoteRef.current?.blur();
        if (key === 'backspace') {
            setAmount((prev) => prev.slice(0, -1));
        } else if (key === '.' && !amount.includes('.')) {
            setAmount((prev) => prev + '.');
        } else if (key !== '.') {
            if (amount.split('.')[0].length >= 8) return;
            setAmount((prev) => prev + key);
        }
    }, [amount]);

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === backdropRef.current && !submitting) handleClose();
    }, [handleClose, submitting]);

    const handleCategorySelect = useCallback((nextCategory: ExpenseCategory) => {
        if (submitting || nextCategory === category) return;
        setCategory(nextCategory);
    }, [category, submitting]);

    const updateBulkRow = useCallback((rowId: string, updates: Partial<BulkExpenseDraft>) => {
        if (submitting) return;
        setBulkRows((prev) => prev.map((row) => row.id === rowId ? { ...row, ...updates } : row));
    }, [submitting]);

    const addBulkRow = useCallback(() => {
        if (submitting) return;
        setBulkRows((prev) => prev.length >= MAX_BULK_EXPENSES ? prev : [...prev, createBulkDraft()]);
    }, [submitting]);

    const removeBulkRow = useCallback((rowId: string) => {
        if (submitting) return;
        setBulkRows((prev) => {
            if (prev.length <= 1) {
                const first = prev[0] ?? createBulkDraft();
                return [{ ...first, amount: '', note: '' }];
            }
            return prev.filter((row) => row.id !== rowId);
        });
    }, [submitting]);

    const handlePointerDown = (e: React.PointerEvent) => {
        setDragStartY(e.clientY);
        setDragCurrentY(e.clientY);
        isDragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || dragStartY === null) return;
        if (e.clientY - dragStartY > 0) setDragCurrentY(e.clientY);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        isDragging.current = false;
        if (!submitting && translateY > 150) handleClose();
        setDragStartY(null);
        setDragCurrentY(null);
    };

    if (!isModalOpen) return null;

    const dragHandleProps = {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
    };

    const isValidAmount = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
    const canSubmitBulk = bulkExpenses.length > 0 && bulkState.errors.length === 0 && bulkExpenses.length <= MAX_BULK_EXPENSES;
    const primaryButtonDisabled = editingExpense
        ? !isValidAmount || submitting
        : entryMode === 'bulk'
            ? !canSubmitBulk || submitting
            : !isValidAmount || submitting;
    const primaryButtonLabel = submitting
        ? editingExpense || entryMode === 'single'
            ? editingExpense ? 'Saving…' : 'Adding…'
            : 'Adding…'
        : editingExpense
            ? 'Save Changes'
            : entryMode === 'bulk'
                ? bulkExpenses.length > 0 ? `Add ${bulkExpenses.length} Expenses` : 'Add Expenses'
                : 'Add Expense';

    const sharedFields = (
        <>
            {(entryMode !== 'bulk' || editingExpense) && (
                <div>
                    <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Category</p>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((item) => (
                            <button key={item} onClick={() => handleCategorySelect(item)} className={`kavish-chip ${category === item ? 'active' : ''}`}>
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {(entryMode !== 'bulk' || editingExpense) && (
                <div>
                    <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Payment</p>
                    <div className="flex flex-wrap gap-2">
                        {PAYMENT_METHODS.map((item) => (
                            <button key={item} onClick={() => !submitting && setPaymentMethod(item)} className={`kavish-chip ${paymentMethod === item ? 'active' : ''}`}>
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {(entryMode !== 'bulk' || editingExpense) && filteredAccounts.length > 0 && (
                <div>
                    <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Account</p>
                    <div className="flex flex-wrap gap-2">
                        {filteredAccounts.map((item) => (
                            <button key={item.id} onClick={() => !submitting && setAccount(item.id)} className={`kavish-chip ${selectedAccount === item.id ? 'active' : ''}`}>
                                {item.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide">
                        {entryMode === 'bulk' && !editingExpense ? 'Shared date & time' : 'When'}
                    </p>
                    {entryMode === 'bulk' && !editingExpense && (
                        <p className="text-[12px] text-(--color-text-muted)">Top line gets the latest time</p>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                if (!submitting) {
                                    setShowCalendar((value) => !value);
                                    setShowTimePicker(false);
                                }
                            }}
                            className="w-full h-11 flex items-center gap-2.5 px-3.5 bg-(--color-surface2) border border-(--color-border2) rounded-xl text-[14px] font-medium text-(--color-text-primary) active:opacity-70 transition-opacity"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span className="truncate">{new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        </button>
                        {showCalendar && (
                            <div className="absolute bottom-full left-0 mb-2 z-[60] kavish-slide-up">
                                <Calendar
                                    selectedDate={new Date(date)}
                                    onSelect={(selectedDate) => {
                                        const current = new Date(date);
                                        selectedDate.setHours(current.getHours(), current.getMinutes(), current.getSeconds());
                                        setDate(selectedDate.toISOString());
                                        setShowCalendar(false);
                                    }}
                                    className="shadow-[0_20px_50px_rgba(0,0,0,0.25)] bg-(--color-surface) p-4!"
                                />
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                if (!submitting) {
                                    setShowTimePicker((value) => !value);
                                    setShowCalendar(false);
                                }
                            }}
                            className="w-full h-11 flex items-center gap-2.5 px-3.5 bg-(--color-surface2) border border-(--color-border2) rounded-xl text-[14px] font-medium text-(--color-text-primary) active:opacity-70 transition-opacity"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span>{new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </button>
                        {showTimePicker && (
                            <div className="absolute bottom-full right-0 mb-2 z-[60] kavish-slide-up">
                                <TimePicker
                                    value={date}
                                    onChange={setDate}
                                    className="shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
            style={{ opacity: translateY > 0 ? 1 - translateY / 500 : 1 }}
        >
            <div
                className="w-full max-w-lg kavish-slide-up rounded-t-[28px] bg-(--color-surface) shadow-[0_-8px_40px_rgba(0,0,0,0.18)] flex flex-col max-h-[90vh]"
                style={{
                    transform: `translateY(${translateY - viewportOffset}px)`,
                    transition: dragStartY === null ? 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' : 'none',
                }}
            >
                <div className="flex justify-center pt-2.5 pb-1 touch-none cursor-grab active:cursor-grabbing" {...dragHandleProps}>
                    <div className="w-10 h-1 rounded-full bg-(--color-border)" />
                </div>

                <div className="flex items-center justify-between px-5 py-3 touch-none cursor-grab active:cursor-grabbing" {...dragHandleProps}>
                    <span className="text-[17px] font-semibold text-(--color-text-primary)">
                        {editingExpense ? 'Edit Expense' : entryMode === 'bulk' ? 'Bulk Add' : 'New Expense'}
                    </span>
                    <button
                        onClick={() => !submitting && handleClose()}
                        disabled={submitting}
                        className="w-8 h-8 rounded-full bg-(--color-surface2) flex items-center justify-center text-(--color-text-secondary) active:opacity-60 transition-opacity disabled:opacity-30"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {!editingExpense && (
                    <div className="px-5 pb-3">
                        <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-(--color-surface2) p-1">
                            <button
                                type="button"
                                onClick={() => !submitting && setEntryMode('single')}
                                className={`h-10 rounded-[10px] text-[14px] font-semibold transition-all ${entryMode === 'single' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-[0_1px_6px_rgba(0,0,0,0.08)]' : 'text-(--color-text-secondary)'}`}
                            >
                                Single
                            </button>
                            <button
                                type="button"
                                onClick={() => !submitting && setEntryMode('bulk')}
                                className={`h-10 rounded-[10px] text-[14px] font-semibold transition-all ${entryMode === 'bulk' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-[0_1px_6px_rgba(0,0,0,0.08)]' : 'text-(--color-text-secondary)'}`}
                            >
                                Bulk
                            </button>
                        </div>
                    </div>
                )}

                {entryMode === 'single' || editingExpense ? (
                    <div className="mx-5 mb-1 bg-(--color-surface2) rounded-[14px] flex items-center px-4 py-3 gap-2">
                        <span className="text-[22px] text-(--color-text-muted) font-medium select-none">₹</span>
                        <span className={`text-[36px] font-semibold tracking-tight leading-none flex-1 ${amount ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)'}`}>
                            {amount || '0'}
                        </span>
                        {amount && !submitting && (
                            <button onClick={() => setAmount('')} className="text-(--color-text-muted) active:text-(--color-text-primary) transition-colors p-1">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                    <line x1="18" y1="9" x2="12" y2="15" />
                                    <line x1="12" y1="9" x2="18" y2="15" />
                                </svg>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="mx-5 mb-1 rounded-[18px] border border-(--color-border2) bg-(--color-surface2) px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[15px] font-semibold text-(--color-text-primary)">Add expenses row by row</p>
                                <p className="text-[13px] text-(--color-text-secondary) mt-1">Each row has amount, description, category, and payment mode.</p>
                            </div>
                            <div className="shrink-0 rounded-[12px] bg-(--color-surface) px-3 py-2 text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">Ready</p>
                                <p className="text-[18px] font-semibold text-(--color-text-primary)">{bulkState.items.length}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[13px]">
                            <span className="text-(--color-text-secondary)">Total</span>
                            <span className="font-semibold text-(--color-text-primary)">₹{bulkState.total.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {entryMode === 'bulk' && !editingExpense ? (
                        <>
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide">Expenses</p>
                                    <button
                                        type="button"
                                        onClick={addBulkRow}
                                        disabled={submitting || bulkRows.length >= MAX_BULK_EXPENSES}
                                        className="text-[13px] font-medium text-(--color-accent) disabled:opacity-50"
                                    >
                                        + Add Row
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {bulkRows.map((row, index) => {
                                        const rowAccountOptions = getAccountOptionsForPayment(row.paymentMethod);
                                        const needsAccount = isAccountRequiredForPayment(row.paymentMethod);
                                        const rowSelectedAccount = rowAccountOptions.length === 0
                                            ? ''
                                            : rowAccountOptions.some((item) => item.id === row.account)
                                                ? row.account
                                                : rowAccountOptions[0].id;

                                        return (
                                            <div key={row.id} className="rounded-[16px] border border-(--color-border2) bg-(--color-surface2) p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide">Expense {index + 1}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBulkRow(row.id)}
                                                        disabled={submitting}
                                                        className="text-[12px] font-medium text-(--color-red) disabled:opacity-50"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 gap-2">
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        placeholder="Amount"
                                                        value={row.amount}
                                                        onChange={(e) => updateBulkRow(row.id, { amount: e.target.value })}
                                                        disabled={submitting}
                                                        className="w-full h-11 bg-(--color-surface) border border-(--color-border2) rounded-xl px-3 text-[15px] text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Description"
                                                        value={row.note || ''}
                                                        onChange={(e) => updateBulkRow(row.id, { note: e.target.value })}
                                                        disabled={submitting}
                                                        maxLength={200}
                                                        className="w-full h-11 bg-(--color-surface) border border-(--color-border2) rounded-xl px-3 text-[15px] text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50"
                                                    />
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <select
                                                            value={row.category}
                                                            onChange={(e) => updateBulkRow(row.id, { category: e.target.value as ExpenseCategory })}
                                                            disabled={submitting}
                                                            className="w-full h-11 bg-(--color-surface) border border-(--color-border2) rounded-xl px-3 text-[14px] text-(--color-text-primary) outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50"
                                                        >
                                                            {CATEGORIES.map((categoryOption) => (
                                                                <option key={categoryOption} value={categoryOption}>
                                                                    {categoryOption}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={row.paymentMethod}
                                                            onChange={(e) => {
                                                                const nextPaymentMethod = e.target.value as PaymentMethod;
                                                                const nextRowAccounts = getAccountOptionsForPayment(nextPaymentMethod);
                                                                const nextAccount = nextRowAccounts.length === 0
                                                                    ? ''
                                                                    : nextRowAccounts.some((item) => item.id === row.account)
                                                                        ? row.account
                                                                        : nextRowAccounts[0].id;
                                                                updateBulkRow(row.id, {
                                                                    paymentMethod: nextPaymentMethod,
                                                                    account: nextAccount,
                                                                });
                                                            }}
                                                            disabled={submitting}
                                                            className="w-full h-11 bg-(--color-surface) border border-(--color-border2) rounded-xl px-3 text-[14px] text-(--color-text-primary) outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50"
                                                        >
                                                            {PAYMENT_METHODS.map((paymentOption) => (
                                                                <option key={paymentOption} value={paymentOption}>
                                                                    {paymentOption}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {needsAccount && (
                                                        <select
                                                            value={rowSelectedAccount}
                                                            onChange={(e) => updateBulkRow(row.id, { account: e.target.value })}
                                                            disabled={submitting || rowAccountOptions.length === 0}
                                                            className="w-full h-11 bg-(--color-surface) border border-(--color-border2) rounded-xl px-3 text-[14px] text-(--color-text-primary) outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50"
                                                        >
                                                            {rowAccountOptions.length > 0 ? (
                                                                rowAccountOptions.map((accountOption) => (
                                                                    <option key={accountOption.id} value={accountOption.id}>
                                                                        {accountOption.name}
                                                                    </option>
                                                                ))
                                                            ) : (
                                                                <option value="">
                                                                    {row.paymentMethod === 'Credit Card' ? 'No Credit Card account available' : 'No Bank account available'}
                                                                </option>
                                                            )}
                                                        </select>
                                                    )}
                                                    {needsAccount && rowAccountOptions.length === 0 && (
                                                        <p className="text-[12px] text-(--color-red)">Create a matching account in Accounts to use {row.paymentMethod}.</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {bulkState.errors.length > 0 && (
                                <div className="rounded-[18px] border border-(--color-red)/20 bg-(--color-red)/10 px-4 py-3 space-y-2 ios-fade-in">
                                    <p className="text-[12px] font-semibold uppercase tracking-wide text-(--color-red)">Fix these rows</p>
                                    {bulkState.errors.slice(0, 3).map((error) => (
                                        <p key={error} className="text-[13px] text-(--color-red)">{error}</p>
                                    ))}
                                    {bulkState.errors.length > 3 && <p className="text-[13px] text-(--color-red)">+{bulkState.errors.length - 3} more issues</p>}
                                </div>
                            )}

                            {sharedFields}
                        </>
                    ) : (
                        <>
                            {sharedFields}

                            <div>
                                <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Note</p>
                                <input
                                    ref={singleNoteRef}
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="e.g. Lunch with friends"
                                    disabled={submitting}
                                    maxLength={200}
                                    className="w-full h-11 bg-(--color-surface2) border border-(--color-border2) rounded-xl px-4 text-[15px] text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50"
                                />
                            </div>
                        </>
                    )}
                </div>

                {confirmDelete && (
                    <div className="mx-5 mb-3 bg-(--color-red)/10 border border-(--color-red)/20 rounded-xl px-4 py-3 flex items-center justify-between ios-fade-in">
                        <p className="text-[14px] font-medium text-(--color-red)">Delete this expense?</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDelete(false)}
                                disabled={submitting}
                                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-(--color-text-secondary) bg-(--color-surface2) active:opacity-70 transition-opacity"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={submitting}
                                className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-(--color-red) active:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {submitting ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : null}
                                Delete
                            </button>
                        </div>
                    </div>
                )}

                <div className="px-5 py-3 border-t border-(--color-border2) flex items-center gap-3">
                    {editingExpense && !confirmDelete && (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            disabled={submitting}
                            className="h-11 px-4 rounded-xl text-[15px] font-medium text-(--color-red) active:bg-(--color-red)/10 transition-colors disabled:opacity-40"
                        >
                            Delete
                        </button>
                    )}
                    <button
                        onClick={() => !submitting && handleClose()}
                        disabled={submitting}
                        className="h-11 px-4 rounded-xl text-[15px] font-medium text-(--color-text-secondary) bg-(--color-surface2) active:opacity-70 transition-opacity disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={primaryButtonDisabled}
                        className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white bg-(--color-accent) disabled:opacity-40 active:opacity-80 transition-opacity shadow-[0_2px_10px_rgba(255,87,34,0.3)] flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                <span>{primaryButtonLabel}</span>
                            </>
                        ) : (
                            primaryButtonLabel
                        )}
                    </button>
                </div>

                {(entryMode === 'single' || editingExpense) && (
                    <div className={`grid grid-cols-3 gap-px bg-(--color-border2) pb-safe transition-opacity ${submitting ? 'opacity-40 pointer-events-none' : ''}`}>
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                            <button
                                key={key}
                                onClick={() => handleKeypadPress(key === '⌫' ? 'backspace' : key)}
                                className="flex items-center justify-center h-14 bg-(--color-surface) text-[22px] font-normal text-(--color-text-primary) active:bg-(--color-surface2) transition-colors"
                            >
                                {key === '⌫' ? (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                        <line x1="18" y1="9" x2="12" y2="15" />
                                        <line x1="12" y1="9" x2="18" y2="15" />
                                    </svg>
                                ) : key}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
