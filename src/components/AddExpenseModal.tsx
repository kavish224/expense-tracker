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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        >
            <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-gray-700/30 bg-white dark:bg-[#1a1e2e] pb-safe">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pb-4">
                    <button
                        onClick={closeModal}
                        className="text-sm text-gray-400 hover:text-gray-300"
                    >
                        Cancel
                    </button>
                    <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                        Add Expense
                    </h2>
                    <button
                        onClick={handleSave}
                        disabled={!amount || parseFloat(amount) <= 0}
                        className="text-sm font-semibold text-blue-500 disabled:text-gray-600 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>

                {/* Amount */}
                <div className="px-6 pb-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                        <span className="text-2xl text-gray-400 dark:text-gray-500">₹</span>
                        <input
                            ref={inputRef}
                            type="number"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="w-full bg-transparent text-center text-5xl font-light tracking-tight text-gray-800 dark:text-white outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                </div>

                {/* Category chips */}
                <div className="px-6 pb-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Category
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${category === cat
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                    : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/60'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Payment method chips */}
                <div className="px-6 pb-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Payment Method
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {PAYMENT_METHODS.map((method) => (
                            <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${paymentMethod === method
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                    : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/60'
                                    }`}
                            >
                                {method}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Note */}
                <div className="px-6 pb-4">
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note (optional)"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/40 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-blue-500/50"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                        }}
                    />
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-px border-t border-gray-200 dark:border-gray-800/60 bg-gray-200 dark:bg-gray-800/60">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map(
                        (key) => (
                            <button
                                key={key}
                                onClick={() => handleKeypadPress(key)}
                                className="flex h-14 items-center justify-center bg-white dark:bg-[#1a1e2e] text-lg font-medium text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800/80 transition-colors"
                            >
                                {key === 'backspace' ? (
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                                        <line x1="18" y1="9" x2="12" y2="15" />
                                        <line x1="12" y1="9" x2="18" y2="15" />
                                    </svg>
                                ) : (
                                    key
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
