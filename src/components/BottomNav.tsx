'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useExpenseStore } from '@/store/useExpenseStore';

const navItems = [
    {
        label: 'Dashboard',
        href: '/',
        icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#2563eb' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        ),
    },
    {
        label: 'Analytics',
        href: '/analytics',
        icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#2563eb' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
        ),
    },
    {
        label: 'Accounts',
        href: '/accounts',
        icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#2563eb' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
        ),
    },
];

export default function BottomNav() {
    const pathname = usePathname();
    const openModal = useExpenseStore((s) => s.openModal);

    return (
        <>
            {/* Spacer to prevent content from being hidden behind nav */}
            <div className="h-20" />

            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800/50 dark:border-gray-800/50 border-gray-200/80 bg-white/80 dark:bg-[#1c2030]/95 backdrop-blur-xl safe-area-bottom">
                <div className="mx-auto flex max-w-lg items-center justify-around px-2">
                    {navItems.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${active
                                        ? 'text-blue-500'
                                        : 'text-gray-500 dark:text-gray-400'
                                    }`}
                            >
                                {item.icon(active)}
                                <span className="mt-0.5">{item.label}</span>
                            </Link>
                        );
                    })}

                    {/* FAB */}
                    <button
                        onClick={openModal}
                        className="flex flex-col items-center gap-0.5 py-2 px-3 text-xs text-gray-500 dark:text-gray-400"
                        aria-label="Add expense"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-95">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </div>
                        <span className="mt-0.5">Add</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
