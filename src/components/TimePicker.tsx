'use client';

import React, { useEffect, useRef } from 'react';

interface TimePickerProps {
    value: string; // ISO String
    onChange: (date: string) => void;
    className?: string;
}

export default function TimePicker({ value, onChange, className = '' }: TimePickerProps) {
    const date = new Date(value);
    const h24 = date.getHours();
    const currentHours = h24 % 12 || 12;
    const currentMinutes = date.getMinutes();
    const currentAmpm = h24 >= 12 ? 'PM' : 'AM';

    const hourRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const minuteRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const updateTime = (h: number, m: number, ap: string) => {
        const newDate = new Date(value);
        let finalH = h % 12;
        if (ap === 'PM') finalH += 12;
        newDate.setHours(finalH, m);
        onChange(newDate.toISOString());
    };

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    useEffect(() => {
        // Scroll active items into view on mount
        setTimeout(() => {
            hourRefs.current[currentHours - 1]?.scrollIntoView({ block: 'center', behavior: 'auto' });
            minuteRefs.current[currentMinutes]?.scrollIntoView({ block: 'center', behavior: 'auto' });
        }, 50);
    }, []);

    return (
        <div className={`flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden h-64 w-64 ${className}`}>
            <style jsx>{`
                .picker-column::-webkit-scrollbar {
                    width: 2px;
                }
                .picker-column::-webkit-scrollbar-track {
                    background: transparent;
                }
                .picker-column::-webkit-scrollbar-thumb {
                    background: var(--color-border);
                    border-radius: 10px;
                }
            `}</style>

            {/* Hours */}
            <div className="flex-1 overflow-y-auto py-3 px-1.5 picker-column border-r border-[var(--color-border2)]">
                {hours.map((h) => (
                    <button
                        key={h}
                        ref={(el) => { if (el) hourRefs.current[h - 1] = el; }}
                        onClick={() => updateTime(h, currentMinutes, currentAmpm)}
                        className={`w-full py-3 rounded-lg text-[14px] font-semibold mb-1 transition-all active:scale-90 ${currentHours === h
                                ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface2)]'
                            }`}
                    >
                        {h.toString().padStart(2, '0')}
                    </button>
                ))}
            </div>

            {/* Minutes */}
            <div className="flex-1 overflow-y-auto py-3 px-1.5 picker-column border-r border-[var(--color-border2)]">
                {minutes.map((m) => (
                    <button
                        key={m}
                        ref={(el) => { if (el) minuteRefs.current[m] = el; }}
                        onClick={() => updateTime(currentHours, m, currentAmpm)}
                        className={`w-full py-3 rounded-lg text-[14px] font-semibold mb-1 transition-all active:scale-90 ${currentMinutes === m
                                ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface2)]'
                            }`}
                    >
                        {m.toString().padStart(2, '0')}
                    </button>
                ))}
            </div>

            {/* AM/PM */}
            <div className="w-20 flex flex-col justify-center gap-3 p-2 bg-[var(--color-bg)]">
                {['AM', 'PM'].map((ap) => (
                    <button
                        key={ap}
                        onClick={() => updateTime(currentHours, currentMinutes, ap)}
                        className={`w-full py-5 rounded-2xl text-[11px] font-black tracking-widest transition-all active:scale-95 ${currentAmpm === ap
                                ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20'
                                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)]'
                            }`}
                    >
                        {ap}
                    </button>
                ))}
            </div>
        </div>
    );
}
