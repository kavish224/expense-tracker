'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { CATEGORIES, PAYMENT_METHODS, Account } from '@/lib/types';
import Calendar from './Calendar';
import TimePicker from './TimePicker';

export default function AddExpenseModal() {
    const { isModalOpen, closeModal, addExpense, updateExpense, deleteExpense, accounts, editingExpense } = useExpenseStore();
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>(CATEGORIES[0]);
    const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
    const [account, setAccount] = useState<string>('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString());
    const [showCalendar, setShowCalendar] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const noteRef = useRef<HTMLInputElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    // Swipe down tracking with pointer events
    const [dragStartY, setDragStartY] = useState<number | null>(null);
    const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
    const isDragging = useRef(false);
    const translateY = dragCurrentY && dragStartY ? Math.max(0, dragCurrentY - dragStartY) : 0;

    // Visual Viewport API — tracks the actual visible bottom of the screen.
    // On iOS, when the software keyboard opens, visualViewport.height shrinks
    // and visualViewport.offsetTop increases. We use this to push the sheet up
    // so it always sits flush at the keyboard top instead of going off-screen.
    const [viewportOffset, setViewportOffset] = useState(0);
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        const onResize = () => {
            // How far the visual viewport bottom is from the layout viewport bottom
            const offset = window.innerHeight - (vv.height + vv.offsetTop);
            setViewportOffset(Math.max(0, offset));
        };

        vv.addEventListener('resize', onResize);
        vv.addEventListener('scroll', onResize);
        return () => {
            vv.removeEventListener('resize', onResize);
            vv.removeEventListener('scroll', onResize);
        };
    }, []);

    // Filter accounts based on selected payment method
    const filteredAccounts = useMemo(() => {
        if (paymentMethod === 'UPI' || paymentMethod === 'Debit Card' || paymentMethod === 'Net Banking') {
            return accounts.filter(acc => acc.type === 'Bank');
        }
        if (paymentMethod === 'Credit Card') {
            return accounts.filter(acc => acc.type === 'CreditCard');
        }
        return []; // No accounts for Cash, Wallet, etc.
    }, [accounts, paymentMethod]);

    useEffect(() => {
        if (isModalOpen) {
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
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isModalOpen, editingExpense]);

    // Update account when payment method changes or accounts are loaded
    useEffect(() => {
        if (editingExpense && isModalOpen) return; // Don't override account if editing

        if (filteredAccounts.length > 0) {
            setAccount(filteredAccounts[0].id);
        } else {
            setAccount('');
        }
    }, [filteredAccounts, editingExpense, isModalOpen]);

    const handleSave = useCallback(async () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return;

        const expenseData = {
            amount: parsed,
            category,
            paymentMethod,
            account: account || undefined,
            date,
            note: note.trim() || undefined,
        };

        if (editingExpense) {
            if (window.confirm('Save changes to this expense?')) {
                await updateExpense(editingExpense.id, expenseData);
                closeModal();
            }
        } else {
            await addExpense(expenseData);
            closeModal();
        }
    }, [amount, category, paymentMethod, account, note, date, addExpense, updateExpense, editingExpense, closeModal]);

    // Cleanup state forcefully when modal is forcefully closed externally
    // Also lock the scroll container so background doesn't scroll behind the sheet
    useEffect(() => {
        const container = document.getElementById('scroll-container');
        if (!isModalOpen) {
            setDragStartY(null);
            setDragCurrentY(null);
            setViewportOffset(0);
            isDragging.current = false;
            if (container) container.style.overflow = '';
        } else {
            if (container) container.style.overflow = 'hidden';
        }
        return () => {
            if (container) container.style.overflow = '';
        };
    }, [isModalOpen]);

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === backdropRef.current) {
                closeModal();
            }
        },
        [closeModal]
    );

    const handleKeypadPress = useCallback((key: string) => {
        // Dismiss the native iOS keyboard if the note field is focused
        noteRef.current?.blur();

        if (key === 'backspace') {
            setAmount((prev) => prev.slice(0, -1));
        } else if (key === '.' && !amount.includes('.')) {
            setAmount((prev) => prev + '.');
        } else if (key !== '.') {
            setAmount((prev) => prev + key);
        }
    }, [amount]);

    // Pointer event handlers for swipe
    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'touch' || e.pointerType === 'mouse') {
            setDragStartY(e.clientY);
            setDragCurrentY(e.clientY);
            isDragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || !dragStartY) return;
        const delta = e.clientY - dragStartY;

        // Only allow swiping DOWN
        if (delta > 0) {
            setDragCurrentY(e.clientY);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        isDragging.current = false;

        const delta = dragCurrentY && dragStartY ? dragCurrentY - dragStartY : 0;
        if (delta > 150) {
            // Threshold reached, close modal
            closeModal();
        }

        setDragStartY(null);
        setDragCurrentY(null);
    };

    if (!isModalOpen) return null;

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm transition-opacity"
            style={{ opacity: translateY > 0 ? 1 - translateY / 500 : 1 }}
        >
            <div
                className="w-full max-w-lg kavish-slide-up rounded-t-3xl bg-[var(--color-surface)] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col max-h-[85vh]"
                style={{
                    // viewportOffset lifts the sheet above the iOS keyboard.
                    // translateY handles the swipe-to-dismiss gesture.
                    transform: `translateY(${translateY - viewportOffset}px)`,
                    transition: dragStartY === null ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
                }}
            >
                {/* Premium Sheet Handle - Swipable Area */}
                <div
                    className="w-full flex justify-center pt-3 pb-1 bg-[var(--color-bg)] rounded-t-3xl touch-none cursor-grab active:cursor-grabbing"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <div className="w-12 h-1.5 bg-[var(--color-border)] rounded-full"></div>
                </div>

                {/* Header - Swipable Area */}
                <div
                    className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border2)] bg-[var(--color-bg)] touch-none cursor-grab active:cursor-grabbing"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">
                            {editingExpense ? 'Edit Expense' : 'Add Expense'}
                        </span>
                    </div>
                    <button onClick={closeModal} className="h-8 w-8 bg-[var(--color-surface2)] rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] active:scale-95 transition-all">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    <div>
                        <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5 uppercase font-medium">Amount (INR)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-text-secondary)]">₹</span>
                            <input
                                ref={inputRef}
                                type="text"
                                inputMode="decimal"
                                readOnly
                                value={amount}
                                placeholder="0.00"
                                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-8 py-3 text-[24px] font-medium text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[12px] text-[var(--color-text-secondary)] block mb-2 uppercase font-medium">Category</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`kavish-chip ${category === cat ? 'active' : ''}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[12px] text-[var(--color-text-secondary)] block mb-2 uppercase font-medium">Payment Method</label>
                        <div className="flex flex-wrap gap-2">
                            {PAYMENT_METHODS.map((method) => (
                                <button
                                    key={method}
                                    onClick={() => setPaymentMethod(method)}
                                    className={`kavish-chip ${paymentMethod === method ? 'active' : ''}`}
                                >
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredAccounts.length > 0 && (
                        <div>
                            <label className="text-[12px] text-[var(--color-text-secondary)] block mb-2 uppercase font-medium">Select Account</label>
                            <div className="flex flex-wrap gap-2">
                                {filteredAccounts.map((acc) => (
                                    <button
                                        key={acc.id}
                                        onClick={() => setAccount(acc.id)}
                                        className={`kavish-chip ${account === acc.id ? 'active' : ''}`}
                                    >
                                        {acc.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="text-[11px] text-[var(--color-text-secondary)] block mb-1 uppercase font-bold tracking-wider">Timestamp</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCalendar(!showCalendar);
                                        setShowTimePicker(false);
                                    }}
                                    className="w-full h-12 flex items-center justify-between px-4 bg-[var(--color-surface2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[14px] font-semibold text-[var(--color-text-primary)] transition-all active:scale-[0.98] group"
                                >
                                    <div className="flex items-center gap-3">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)] group-hover:scale-110 transition-transform">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </button>

                                {showCalendar && (
                                    <div className="absolute bottom-full left-0 mb-3 z-[60] kavish-slide-up">
                                        <Calendar
                                            selectedDate={new Date(date)}
                                            onSelect={(newDate) => {
                                                const current = new Date(date);
                                                newDate.setHours(current.getHours(), current.getMinutes(), current.getSeconds());
                                                setDate(newDate.toISOString());
                                                setShowCalendar(false);
                                            }}
                                            className="shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-[var(--color-border2)] bg-[var(--color-surface)] !p-4"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowTimePicker(!showTimePicker);
                                        setShowCalendar(false);
                                    }}
                                    className="w-full h-12 flex items-center justify-between px-4 bg-[var(--color-surface2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[14px] font-semibold text-[var(--color-text-primary)] transition-all active:scale-[0.98] group"
                                >
                                    <div className="flex items-center gap-3">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)] group-hover:scale-110 transition-transform">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12 6 12 12 16 14"></polyline>
                                        </svg>
                                        {new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </div>
                                </button>

                                {showTimePicker && (
                                    <div className="absolute bottom-full right-0 mb-3 z-[60] kavish-slide-up">
                                        <TimePicker
                                            value={date}
                                            onChange={(newDate) => setDate(newDate)}
                                            className="shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-[var(--color-border2)]"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5 uppercase font-medium">Note</label>
                        <input
                            ref={noteRef}
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Lunch with friends"
                            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-4 py-2.5 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                </div>

                {/* Footer with Numpad Toggle & Action Button */}
                <div className="bg-[var(--color-bg)] border-t border-[var(--color-border2)] p-5 flex items-center justify-between">
                    <span className="text-[12px] text-[var(--color-text-secondary)] italic"></span>
                    <div className="flex gap-3">
                        {editingExpense && (
                            <button
                                onClick={async () => {
                                    if (window.confirm('Permanently delete this expense?')) {
                                        await deleteExpense(editingExpense.id);
                                        closeModal();
                                    }
                                }}
                                className="px-4 py-2.5 text-[14px] font-semibold text-[var(--color-red)] hover:bg-[var(--color-red)]/10 rounded transition-colors mr-auto"
                            >
                                Delete
                            </button>
                        )}
                        <button
                            onClick={closeModal}
                            className="px-6 py-2.5 text-[14px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface2)] rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!amount || parseFloat(amount) <= 0}
                            className="px-10 py-2.5 text-[14px] font-semibold text-white bg-[var(--color-accent)] hover:bg-[#cc4a38] rounded shadow-lg shadow-[#ff5722]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {editingExpense ? 'Update' : 'Add'}
                        </button>
                    </div>
                </div>

                {/* Standard 3x4 NumPad */}
                <div className="grid grid-cols-3 gap-px bg-[var(--color-border2)] pb-safe">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                        <button
                            key={key}
                            onClick={() => handleKeypadPress(key === '⌫' ? 'backspace' : key)}
                            className="flex items-center justify-center h-16 bg-[var(--color-surface)] text-[22px] font-normal text-[var(--color-text-primary)] active:bg-[var(--color-surface2)] transition-colors"
                        >
                            {key === '⌫' ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                                    <line x1="18" y1="9" x2="12" y2="15"></line>
                                    <line x1="12" y1="9" x2="18" y2="15"></line>
                                </svg>
                            ) : (
                                key
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
