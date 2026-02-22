'use client';

import React, { useState } from 'react';

interface CalendarProps {
    selectedDate: Date | null;
    onSelect: (date: Date) => void;
    className?: string;
}

export default function Calendar({ selectedDate, onSelect, className = '' }: CalendarProps) {
    const [viewDate, setViewDate] = useState(selectedDate || new Date());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const isSelected = (day: number) => {
        return selectedDate &&
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === month &&
            selectedDate.getFullYear() === year;
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year;
    };

    const days = [];
    // Add empty slots for the beginning of the month
    for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    // Add actual days
    for (let i = 1; i <= totalDays; i++) {
        days.push(
            <button
                key={i}
                onClick={() => onSelect(new Date(year, month, i))}
                className={`h-8 w-8 rounded-full text-[11px] font-medium transition-all flex items-center justify-center
          ${isSelected(i)
                        ? 'bg-[#ff5722] text-white shadow-md scale-110 z-10'
                        : isToday(i)
                            ? 'border border-[#ff5722] text-[#ff5722]'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface2)]'
                    }`}
            >
                {i}
            </button>
        );
    }

    return (
        <div className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 shadow-sm select-none ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <button
                    onClick={prevMonth}
                    className="p-1.5 rounded-full hover:bg-[var(--color-surface2)] text-[var(--color-text-secondary)] transition-colors"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="text-[12px] font-bold text-[var(--color-text-primary)] tracking-tight">
                    {monthNames[month]} {year}
                </span>
                <button
                    onClick={nextMonth}
                    className="p-1.5 rounded-full hover:bg-[var(--color-surface2)] text-[var(--color-text-secondary)] transition-colors"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div key={d} className="h-8 w-8 flex items-center justify-center text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-y-1">
                {days}
            </div>
        </div>
    );
}
