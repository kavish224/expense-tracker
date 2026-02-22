'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { CATEGORIES, PAYMENT_METHODS } from '@/lib/types';

export default function AddExpenseModal() {
    const { isModalOpen, closeModal, addExpense } = useExpenseStore();
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>(CATEGORIES[0]);
    const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
    const [note, setNote] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isModalOpen) {
            setAmount('');
            setCategory(CATEGORIES[0]);
            setPaymentMethod(PAYMENT_METHODS[0]);
            setNote('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isModalOpen]);

    const handleSave = useCallback(async () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return;

        await addExpense({
            amount: parsed,
            category,
            paymentMethod,
            date: new Date().toISOString(),
            note: note.trim() || undefined,
        });

        closeModal();
    }, [amount, category, paymentMethod, note, addExpense, closeModal]);

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

    if (!isModalOpen) return null;

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
        >
            <div className="w-full max-w-md kavish-slide-up rounded-t-lg bg-[var(--color-surface)] shadow-2xl pb-safe border-t border-[var(--color-border)]">
                {/* kavish style order header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border2)] bg-[var(--color-bg)] rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[color:var(--color-accent)] uppercase">Buy</span>
                        <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">New Expense</span>
                    </div>
                    <button onClick={closeModal} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Amount Input Section */}
                <div className="p-5 space-y-5">
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
                    <span className="text-[12px] text-[var(--color-text-secondary)] italic">Local-first expense tracking</span>
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
                            Buy
                        </button>
                    </div>
                </div>

                {/* Quick NumPad (kavish doesn't have this, but keeping it for UX efficiency) */}
                <div className="grid grid-cols-4 gap-px bg-[var(--color-border2)]">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                        <button
                            key={key}
                            onClick={() => handleKeypadPress(key === '⌫' ? 'backspace' : key)}
                            className="h-12 bg-[var(--color-surface)] text-[16px] font-medium text-[var(--color-text-primary)] active:bg-[var(--color-surface2)]"
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
