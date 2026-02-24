'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { CATEGORIES, PAYMENT_METHODS, Account } from '@/lib/types';

export default function AddExpenseModal() {
    const { isModalOpen, closeModal, addExpense, accounts } = useExpenseStore();
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>(CATEGORIES[0]);
    const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
    const [account, setAccount] = useState<string>('');
    const [note, setNote] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    // Swipe down tracking
    const [startY, setStartY] = useState<number | null>(null);
    const [translateY, setTranslateY] = useState(0);

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
            setAmount('');
            setCategory(CATEGORIES[0]);
            setPaymentMethod(PAYMENT_METHODS[0]);
            setAccount('');
            setNote('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isModalOpen]);

    // Update account when payment method changes or accounts are loaded
    useEffect(() => {
        if (filteredAccounts.length > 0) {
            setAccount(filteredAccounts[0].id);
        } else {
            setAccount('');
        }
    }, [filteredAccounts]);

    const handleSave = useCallback(async () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return;

        await addExpense({
            amount: parsed,
            category,
            paymentMethod,
            account: account || undefined,
            date: new Date().toISOString(),
            note: note.trim() || undefined,
        });

        closeModal();
    }, [amount, category, paymentMethod, account, note, addExpense, closeModal]);

    // Cleanup state forcefully when modal is forcefully closed externally
    useEffect(() => {
        if (!isModalOpen) {
            setTranslateY(0);
            setStartY(null);
        }
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
        if (key === 'backspace') {
            setAmount((prev) => prev.slice(0, -1));
        } else if (key === '.' && !amount.includes('.')) {
            setAmount((prev) => prev + '.');
        } else if (key !== '.') {
            setAmount((prev) => prev + key);
        }
    }, [amount]);

    // Swipe handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        // Only track single touches
        if (e.touches.length !== 1) return;
        setStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY === null) return;
        const currentY = e.touches[0].clientY;
        const delta = currentY - startY;

        // Only allow swiping DOWN
        if (delta > 0) {
            setTranslateY(delta);
        }
    };

    const handleTouchEnd = () => {
        if (translateY > 150) {
            // Threshold reached, close modal
            closeModal();
        } else {
            // Snap back
            setTranslateY(0);
        }
        setStartY(null);
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
                className="w-full max-w-lg kavish-slide-up rounded-t-3xl bg-[var(--color-surface)] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col max-h-[85vh] transition-transform"
                style={{
                    transform: `translateY(${translateY}px)`,
                    transition: startY === null ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
                }}
            >
                {/* Premium Sheet Handle - Swipable Area */}
                <div
                    className="w-full flex justify-center pt-3 pb-1 bg-[var(--color-bg)] rounded-t-3xl touch-none cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={(e: any) => handleTouchStart({ touches: [{ clientY: e.clientY }] } as any)}
                    onMouseMove={(e: any) => startY !== null && handleTouchMove({ touches: [{ clientY: e.clientY }] } as any)}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-[var(--color-border)] rounded-full"></div>
                </div>

                {/* Header - Swipable Area */}
                <div
                    className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border2)] bg-[var(--color-bg)] touch-none cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={(e: any) => handleTouchStart({ touches: [{ clientY: e.clientY }] } as any)}
                    onMouseMove={(e: any) => startY !== null && handleTouchMove({ touches: [{ clientY: e.clientY }] } as any)}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">Add Expense</span>
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
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
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

                    <div>
                        <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5 uppercase font-medium">Note</label>
                        <input
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
                            Add
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
