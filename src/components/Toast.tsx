'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
    exiting: boolean;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

const DURATION = 3000;
const EXIT_MS = 280;

function ToastBanner({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
    return (
        <div
            onClick={() => onDismiss(toast.id)}
            style={{
                animation: toast.exiting
                    ? `toast-out ${EXIT_MS}ms ease forwards`
                    : 'toast-in 0.3s cubic-bezier(0.32,0.72,0,1)',
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-md pointer-events-auto cursor-pointer select-none
                ${toast.type === 'success'
                    ? 'bg-[var(--color-green)]/15 border-[var(--color-green)]/25 text-[var(--color-green)]'
                    : toast.type === 'error'
                        ? 'bg-[var(--color-red)]/15 border-[var(--color-red)]/25 text-[var(--color-red)]'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)]'
                }`}
        >
            {toast.type === 'success' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            )}
            {toast.type === 'error' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
            )}
            {toast.type === 'info' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            )}
            <span className="text-[14px] font-medium leading-tight flex-1">{toast.message}</span>
        </div>
    );
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), EXIT_MS);
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        // Cap at 3 visible toasts
        setToasts(prev => [...prev.slice(-2), { id, message, type, exiting: false }]);
        setTimeout(() => dismiss(id), DURATION);
    }, [dismiss]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Sits above the 49px bottom nav + safe area */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4 pb-[calc(env(safe-area-inset-bottom)+58px)]">
                {toasts.map(toast => (
                    <ToastBanner key={toast.id} toast={toast} onDismiss={dismiss} />
                ))}
            </div>
            <style>{`
                @keyframes toast-in  { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes toast-out { from { transform: translateY(0);    opacity: 1; } to { transform: translateY(6px); opacity: 0; } }
            `}</style>
        </ToastContext.Provider>
    );
};
