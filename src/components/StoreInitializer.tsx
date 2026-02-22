'use client';

import { useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function StoreInitializer() {
    const loadExpenses = useExpenseStore((s) => s.loadExpenses);
    const isLoaded = useExpenseStore((s) => s.isLoaded);

    useEffect(() => {
        if (!isLoaded) {
            loadExpenses();
        }
    }, [isLoaded, loadExpenses]);

    // Register service worker
    useEffect(() => {
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // SW registration failed silently
            });
        }
    }, []);

    return null;
}
