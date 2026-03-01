'use client';

interface DashboardCardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export default function DashboardCard({ title, children, className = '' }: DashboardCardProps) {
    return (
        <div>
            {/* iOS-style section header: small caps above the card */}
            <p className="text-[13px] font-semibold text-(--color-text-secondary) uppercase tracking-wide px-1 mb-2">
                {title}
            </p>
            <div className={`kavish-card ${className}`}>
                {children}
            </div>
        </div>
    );
}
