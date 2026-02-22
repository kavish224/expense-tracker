'use client';

interface DashboardCardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export default function DashboardCard({ title, children, className = '' }: DashboardCardProps) {
    return (
        <div
            className={`rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white dark:bg-[#1e2235] p-4 shadow-sm ${className}`}
        >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {title}
            </h3>
            {children}
        </div>
    );
}
