'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useExpenseStore } from '@/store/useExpenseStore';

const navItems = [
    {
        label: 'Home',
        href: '/',
        icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
            </svg>
        ),
    },
    {
        label: 'Analytics',
        href: '/analytics',
        icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="12" width="4" height="10" rx="1" fill={active ? 'currentColor' : 'none'} />
                <rect x="9" y="7" width="4" height="15" rx="1" fill={active ? 'currentColor' : 'none'} />
                <rect x="16" y="2" width="4" height="20" rx="1" fill={active ? 'currentColor' : 'none'} />
            </svg>
        ),
    },
    {
        label: 'Accounts',
        href: '/accounts',
        icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="3" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
                <rect x="2" y="5" width="20" height="14" rx="3" />
                <path d="M2 10h20" />
                <path d="M6 15h4" strokeWidth="2" strokeLinecap="round" />
                <circle cx="17" cy="15" r="1.5" fill="currentColor" />
            </svg>
        ),
    },
];

export default function BottomNav() {
    const pathname = usePathname();
    const openModal = useExpenseStore((s) => s.openModal);
    const isModalOpen = useExpenseStore((s) => s.isModalOpen);

    if (isModalOpen) return null;

    return (
        <nav
            className="shrink-0 safe-bottom border-t border-(--color-separator)"
            style={{ background: 'var(--color-nav-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
            <div className="mx-auto grid max-w-lg grid-cols-4 items-center h-[49px]">

                {navItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center gap-0.75 h-full transition-all active:opacity-50 ${
                                active ? 'text-(--color-accent)' : 'text-(--color-text-muted)'
                            }`}
                        >
                            <div className={`transition-transform duration-150 ${active ? 'scale-105' : 'scale-100'}`}>
                                {item.icon(active)}
                            </div>
                            <span className={`text-[10px] tracking-tight ${active ? 'font-semibold text-(--color-accent)' : 'font-medium'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* Add button — iOS-style filled circle */}
                <button
                    onClick={openModal}
                    className="flex flex-col items-center justify-center gap-0.75 h-full active:opacity-50 transition-opacity"
                    aria-label="Add Expense"
                >
                    <div className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-(--color-accent) shadow-[0_2px_8px_rgba(255,87,34,0.4)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </div>
                    <span className="text-[10px] font-medium text-(--color-text-muted) tracking-tight">Add</span>
                </button>

            </div>
        </nav>
    );
}
