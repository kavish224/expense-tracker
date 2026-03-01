'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function StoreInitializer() {
    const initializeData = useExpenseStore((s) => s.initializeData);
    const loading = useExpenseStore((s) => s.loading);
    const setUser = useExpenseStore((s) => s.setUser);
    const user = useExpenseStore((s) => s.user);

    const router = useRouter();
    const pathname = usePathname();
    // Use a ref so initialization runs exactly once per authenticated session,
    // not re-triggered by expenses.length changes (which breaks after deleting all).
    const hasInitialized = useRef(false);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    if (pathname === '/login' || pathname === '/signup') {
                        router.replace('/');
                    }
                } else {
                    setUser(null);
                    hasInitialized.current = false; // reset on logout
                    if (pathname !== '/login' && pathname !== '/signup') {
                        router.replace('/login');
                    }
                }
            } catch (err) {
                console.error('Failed to verify session', err);
            }
        };

        initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    useEffect(() => {
        if (user && !loading.initial && !hasInitialized.current) {
            hasInitialized.current = true;
            initializeData();
        }
    }, [user, loading.initial, initializeData]);

    return null;
}
