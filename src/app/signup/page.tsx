'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const setUser = useExpenseStore((s) => s.setUser);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to sign up');
            } else {
                setUser(data.user);
                router.replace('/');
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-[80vh] flex-col items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-[24px] bg-[var(--color-surface)] p-8 shadow-sm border border-[var(--color-border)]">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Create Account</h1>
                    <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">Sign up to get started</p>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl bg-red-500/10 p-3 text-[13px] text-red-500 border border-red-500/20 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 w-full rounded-xl bg-[var(--color-surface2)] px-4 text-[15px] outline-none border border-transparent focus:border-[var(--color-border)] transition-colors"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12 w-full rounded-xl bg-[var(--color-surface2)] px-4 text-[15px] outline-none border border-transparent focus:border-[var(--color-border)] transition-colors"
                            placeholder="••••••••"
                            minLength={6}
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-12 w-full rounded-xl bg-[var(--color-surface2)] px-4 text-[15px] outline-none border border-transparent focus:border-[var(--color-border)] transition-colors"
                            placeholder="••••••••"
                            minLength={6}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#ff5722] text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? 'Creating account...' : 'Sign Up'}
                    </button>

                    <p className="mt-4 text-center text-[13px] text-[var(--color-text-secondary)]">
                        Already have an account?{' '}
                        <button type="button" onClick={() => router.push('/login')} className="font-medium text-[#ff5722] hover:underline">
                            Log in
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}
