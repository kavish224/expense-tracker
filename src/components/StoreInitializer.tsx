'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function StoreInitializer() {
    const initializeData = useExpenseStore((s) => s.initializeData);
    const loading = useExpenseStore((s) => s.loading);
    const expenses = useExpenseStore((s) => s.expenses);
    const setUser = useExpenseStore((s) => s.setUser);
    const user = useExpenseStore((s) => s.user);

    const router = useRouter();
    const pathname = usePathname();

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
                    if (pathname !== '/login' && pathname !== '/signup') {
                        router.replace('/login');
                    }
                }
            } catch (err) {
                console.error("Failed to verify session", err);
            }
        };

        initAuth();
    }, [pathname, router, setUser]);

    useEffect(() => {
        if (user && !loading.initial && expenses.length === 0) {
            initializeData();
        }
    }, [user, loading.initial, expenses.length, initializeData]);

    useEffect(() => {
        console.log(`📱 App Version: ${process.env.NEXT_PUBLIC_APP_VERSION}`);
    }, []);

    return null;
}
