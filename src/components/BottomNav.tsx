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
        <>
            <div className="h-24" />
            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-nav-border)] bg-[var(--color-nav-bg)] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] pb-[calc(env(safe-area-inset-bottom)+12px)] pt-1">
                <div className="mx-auto flex max-w-lg items-center justify-around px-2">
                    {navItems.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-1 py-3 px-4 transition-colors ${active
                                    ? 'text-[#ff5722]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                    }`}
                            >
                                {item.icon(active)}
                                <span className="text-[11px] font-medium uppercase tracking-wider">{item.label}</span>
                            </Link>
                        );
                    })}

                    <button
                        onClick={openModal}
                        className="flex flex-col items-center gap-1 py-3 px-4 text-[var(--color-text-secondary)] hover:text-[#ff5722]"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff5722] text-white shadow-lg shadow-[#ff5722]/20 active:scale-95 transition-transform">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </div>
                    </button>
                </div>
            </nav>
        </>
    );
}
