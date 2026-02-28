'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useExpenseStore } from '@/store/useExpenseStore';

const navItems = [
    {
        label: 'Dashboard',
        href: '/',
        icon: (active: boolean) => (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ff5722' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ff5722' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ff5722' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-bottom-plus pt-1" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
            <div className="mx-auto grid max-w-lg grid-cols-4 items-center">

                {/* The Original 3 Text Links */}
                {navItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all active:opacity-70 ${active
                                ? 'text-[#ff5722]'
                                : 'text-(--color-text-secondary)'
                                }`}
                        >
                            <div className={`transition-transform duration-150 ${active ? 'scale-110' : 'scale-100'}`}>
                                {item.icon(active)}
                            </div>
                            <span className={`text-[10px] uppercase tracking-wider transition-all duration-150 ${active ? 'font-bold' : 'font-medium'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* The Original Right-Side Add Button */}
                <button
                    onClick={openModal}
                    className="flex flex-col items-center justify-center py-2.5 group"
                    aria-label="Add Expense"
                >
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/30 active:scale-90 transition-all duration-150 border border-[#ff5722]/10">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </div>
                </button>

            </div>
        </nav>
    );
}
