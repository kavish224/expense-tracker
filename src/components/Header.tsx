'use client';

import { useTheme } from './ThemeProvider';

export default function Header() {
    const { theme, toggleTheme } = useTheme();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    return (
        <header className="sticky top-0 z-30 border-b border-[var(--color-nav-border)] bg-[var(--color-nav-bg)] safe-area-top shadow-sm">
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-[#ff5722]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight">
                        Kavish<span className="font-normal text-[var(--color-text-secondary)]"></span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleLogout}
                        className="text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[#ff5722] transition-colors"
                    >
                        Logout
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-secondary)] transition-colors"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
}
