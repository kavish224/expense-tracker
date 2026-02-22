'use client';

interface DashboardCardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export default function DashboardCard({ title, children, className = '' }: DashboardCardProps) {
    return (
        <div className={`kavish-card ${className}`}>
            <div className="border-b border-[var(--color-border2)] px-4 py-3">
                <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                    {title}
                </h3>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
}
