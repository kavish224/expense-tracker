'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { CATEGORIES, PAYMENT_METHODS } from '@/lib/types';
import { useToast } from './Toast';
import Calendar from './Calendar';
import TimePicker from './TimePicker';

export default function AddExpenseModal() {
    const { isModalOpen, closeModal, addExpense, updateExpense, deleteExpense, accounts, editingExpense } = useExpenseStore();
    const { showToast } = useToast();

    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>(CATEGORIES[0]);
    const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
    const [account, setAccount] = useState<string>('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString());
    const [showCalendar, setShowCalendar] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Submitting/loading state — prevents double-tap
    const [submitting, setSubmitting] = useState(false);
    // Inline delete confirmation state instead of window.confirm()
    const [confirmDelete, setConfirmDelete] = useState(false);

    const noteRef = useRef<HTMLInputElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    // Swipe-to-dismiss
    const [dragStartY, setDragStartY] = useState<number | null>(null);
    const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
    const isDragging = useRef(false);
    const translateY = dragCurrentY && dragStartY ? Math.max(0, dragCurrentY - dragStartY) : 0;

    // Visual Viewport API — lifts sheet above iOS software keyboard
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

    // Accounts filtered by payment method
    const filteredAccounts = useMemo(() => {
        if (['UPI', 'Debit Card', 'Net Banking'].includes(paymentMethod)) return accounts.filter(a => a.type === 'Bank');
        if (paymentMethod === 'Credit Card') return accounts.filter(a => a.type === 'CreditCard');
        return [];
    }, [accounts, paymentMethod]);

    // Populate form when opening
    useEffect(() => {
        if (!isModalOpen) return;
        if (editingExpense) {
            setAmount(editingExpense.amount.toString());
            setCategory(editingExpense.category);
            setPaymentMethod(editingExpense.paymentMethod);
            setAccount(editingExpense.account || '');
            setNote(editingExpense.note || '');
            setDate(editingExpense.date);
        } else {
            setAmount('');
            setCategory(CATEGORIES[0]);
            setPaymentMethod(PAYMENT_METHODS[0]);
            setAccount('');
            setNote('');
            setDate(new Date().toISOString());
            setShowCalendar(false);
            setShowTimePicker(false);
        }
        setSubmitting(false);
        setConfirmDelete(false);
    }, [isModalOpen, editingExpense]);

    // Auto-select first account when method changes (not when editing)
    useEffect(() => {
        if (editingExpense && isModalOpen) return;
        setAccount(filteredAccounts.length > 0 ? filteredAccounts[0].id : '');
    }, [filteredAccounts, editingExpense, isModalOpen]);

    // Scroll lock + state cleanup
    useEffect(() => {
        const container = document.getElementById('scroll-container');
        if (!isModalOpen) {
            setDragStartY(null);
            setDragCurrentY(null);
            setViewportOffset(0);
            setSubmitting(false);
            setConfirmDelete(false);
            isDragging.current = false;
            if (container) container.style.overflow = '';
        } else {
            if (container) container.style.overflow = 'hidden';
        }
        return () => { if (container) container.style.overflow = ''; };
    }, [isModalOpen]);

    const handleSave = useCallback(async () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return;
        if (submitting) return; // guard double-tap

        setSubmitting(true);

        const data = {
            amount: parsed,
            category,
            paymentMethod,
            account: account || undefined,
            date,
            note: note.trim() || undefined,
        };

        try {
            if (editingExpense) {
                await updateExpense(editingExpense.id, data);
                showToast('Expense updated', 'success');
            } else {
                await addExpense(data);
                showToast('Expense added', 'success');
            }
            closeModal();
        } catch {
            showToast('Something went wrong. Please try again.', 'error');
            setSubmitting(false);
        }
    }, [amount, category, paymentMethod, account, note, date, addExpense, updateExpense, editingExpense, closeModal, showToast, submitting]);

    const handleDelete = useCallback(async () => {
        if (!editingExpense || submitting) return;
        setSubmitting(true);
        try {
            await deleteExpense(editingExpense.id);
            showToast('Expense deleted', 'success');
            closeModal();
        } catch {
            showToast('Failed to delete. Please try again.', 'error');
            setSubmitting(false);
            setConfirmDelete(false);
        }
    }, [editingExpense, deleteExpense, closeModal, showToast, submitting]);

    const handleKeypadPress = useCallback((key: string) => {
        noteRef.current?.blur(); // dismiss native keyboard
        if (key === 'backspace') {
            setAmount(prev => prev.slice(0, -1));
        } else if (key === '.' && !amount.includes('.')) {
            setAmount(prev => prev + '.');
        } else if (key !== '.') {
            // Limit to reasonable amount length
            if (amount.split('.')[0].length >= 8) return;
            setAmount(prev => prev + key);
        }
    }, [amount]);

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === backdropRef.current && !submitting) closeModal();
    }, [closeModal, submitting]);

    const handlePointerDown = (e: React.PointerEvent) => {
        setDragStartY(e.clientY);
        setDragCurrentY(e.clientY);
        isDragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || !dragStartY) return;
        if (e.clientY - dragStartY > 0) setDragCurrentY(e.clientY);
    };
    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        isDragging.current = false;
        if (!submitting && (dragCurrentY && dragStartY ? dragCurrentY - dragStartY : 0) > 150) closeModal();
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
                {/* Drag handle */}
                <div
                    className="flex justify-center pt-2.5 pb-1 touch-none cursor-grab active:cursor-grabbing"
                    {...dragHandleProps}
                >
                    <div className="w-10 h-1 rounded-full bg-(--color-border)" />
                </div>

                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-3 touch-none cursor-grab active:cursor-grabbing"
                    {...dragHandleProps}
                >
                    <span className="text-[17px] font-semibold text-(--color-text-primary)">
                        {editingExpense ? 'Edit Expense' : 'New Expense'}
                    </span>
                    <button
                        onClick={() => !submitting && closeModal()}
                        disabled={submitting}
                        className="w-8 h-8 rounded-full bg-(--color-surface2) flex items-center justify-center text-(--color-text-secondary) active:opacity-60 transition-opacity disabled:opacity-30"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Amount display */}
                <div className="mx-5 mb-1 bg-(--color-surface2) rounded-[14px] flex items-center px-4 py-3 gap-2">
                    <span className="text-[22px] text-(--color-text-muted) font-medium select-none">₹</span>
                    <span className={`text-[36px] font-semibold tracking-tight leading-none flex-1 ${amount ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)'}`}>
                        {amount || '0'}
                    </span>
                    {amount && !submitting && (
                        <button onClick={() => setAmount('')} className="text-(--color-text-muted) active:text-(--color-text-primary) transition-colors p-1">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Scrollable form */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                    {/* Category chips */}
                    <div>
                        <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Category</p>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => !submitting && setCategory(cat)} className={`kavish-chip ${category === cat ? 'active' : ''}`}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment method chips */}
                    <div>
                        <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Payment</p>
                        <div className="flex flex-wrap gap-2">
                            {PAYMENT_METHODS.map(method => (
                                <button key={method} onClick={() => !submitting && setPaymentMethod(method)} className={`kavish-chip ${paymentMethod === method ? 'active' : ''}`}>
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Account chips */}
                    {filteredAccounts.length > 0 && (
                        <div>
                            <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Account</p>
                            <div className="flex flex-wrap gap-2">
                                {filteredAccounts.map(acc => (
                                    <button key={acc.id} onClick={() => !submitting && setAccount(acc.id)} className={`kavish-chip ${account === acc.id ? 'active' : ''}`}>
                                        {acc.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Date + Time */}
                    <div>
                        <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">When</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { if (!submitting) { setShowCalendar(v => !v); setShowTimePicker(false); } }}
                                    className="w-full h-11 flex items-center gap-2.5 px-3.5 bg-(--color-surface2) border border-(--color-border2) rounded-xl text-[14px] font-medium text-(--color-text-primary) active:opacity-70 transition-opacity"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <span className="truncate">{new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                </button>
                                {showCalendar && (
                                    <div className="absolute bottom-full left-0 mb-2 z-[60] kavish-slide-up">
                                        <Calendar
                                            selectedDate={new Date(date)}
                                            onSelect={(d) => {
                                                const cur = new Date(date);
                                                d.setHours(cur.getHours(), cur.getMinutes(), cur.getSeconds());
                                                setDate(d.toISOString());
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
                                    onClick={() => { if (!submitting) { setShowTimePicker(v => !v); setShowCalendar(false); } }}
                                    className="w-full h-11 flex items-center gap-2.5 px-3.5 bg-(--color-surface2) border border-(--color-border2) rounded-xl text-[14px] font-medium text-(--color-text-primary) active:opacity-70 transition-opacity"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
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

                    {/* Note */}
                    <div>
                        <p className="text-[12px] font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">Note</p>
                        <input
                            ref={noteRef}
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="e.g. Lunch with friends"
                            disabled={submitting}
                            maxLength={200}
                            className="w-full h-11 bg-(--color-surface2) border border-(--color-border2) rounded-xl px-4 text-[15px] text-(--color-text-primary) placeholder:text-(--color-text-muted) outline-none focus:border-(--color-accent) transition-colors disabled:opacity-50"
                        />
                    </div>
                </div>

                {/* Inline delete confirmation bar */}
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
                                {submitting ? (
                                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                ) : null}
                                Delete
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions */}
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
                        onClick={() => !submitting && closeModal()}
                        disabled={submitting}
                        className="h-11 px-4 rounded-xl text-[15px] font-medium text-(--color-text-secondary) bg-(--color-surface2) active:opacity-70 transition-opacity disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isValidAmount || submitting}
                        className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white bg-(--color-accent) disabled:opacity-40 active:opacity-80 transition-opacity shadow-[0_2px_10px_rgba(255,87,34,0.3)] flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                <span>{editingExpense ? 'Saving…' : 'Adding…'}</span>
                            </>
                        ) : (
                            editingExpense ? 'Save Changes' : 'Add Expense'
                        )}
                    </button>
                </div>

                {/* Numpad — disabled during submission */}
                <div className={`grid grid-cols-3 gap-px bg-(--color-border2) pb-safe transition-opacity ${submitting ? 'opacity-40 pointer-events-none' : ''}`}>
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(key => (
                        <button
                            key={key}
                            onClick={() => handleKeypadPress(key === '⌫' ? 'backspace' : key)}
                            className="flex items-center justify-center h-14 bg-(--color-surface) text-[22px] font-normal text-(--color-text-primary) active:bg-(--color-surface2) transition-colors"
                        >
                            {key === '⌫' ? (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                    <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
                                </svg>
                            ) : key}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
