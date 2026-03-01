'use client';

import { useExpenseStore } from '@/store/useExpenseStore';
import DashboardCard from '@/components/DashboardCard';
import {
  getMonthlyTotal,
  getTodayTotal,
  getCategoryTotals,
  formatCurrency,
} from '@/lib/calculations';
import { CATEGORY_COLORS } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useMemo, useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';

const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍜', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
  Bills: '📋', Health: '💊', Education: '🎓', Travel: '✈️',
  Groceries: '🛒', Other: '💰',
};

export default function Dashboard() {
  const expenses = useExpenseStore((s) => s.expenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const openEditModal = useExpenseStore((s) => s.openEditModal);
  const { showToast } = useToast();

  // Inline confirm state: stores the expense id pending deletion
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await deleteExpense(id);
      showToast('Expense deleted', 'success');
    } catch {
      showToast('Failed to delete. Please try again.', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }, [deleteExpense, showToast]);

  const monthlyTotal = useMemo(() => getMonthlyTotal(expenses), [expenses]);
  const todayTotal = useMemo(() => getTodayTotal(expenses), [expenses]);
  const categoryData = useMemo(() => getCategoryTotals(expenses), [expenses]);

  const recentExpenses = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return [...expenses]
      .filter(e => new Date(e.date) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [expenses]);

  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });

  return (
    <main className="mx-auto max-w-lg px-4 pt-5 pb-8 space-y-6">

      {/* Hero — iOS Wallet-style large number */}
      <div className="kavish-card px-5 py-5">
        <p className="text-[13px] font-medium text-(--color-text-secondary) mb-1">{monthName} spending</p>
        <p className="text-[40px] font-bold text-(--color-text-primary) tracking-tight leading-none">
          {formatCurrency(monthlyTotal)}
        </p>
        <div className="mt-3 pt-3 border-t border-(--color-border2) flex items-center justify-between">
          <span className="text-[13px] text-(--color-text-secondary)">Today</span>
          <span className="text-[15px] font-semibold text-(--color-text-primary)">{formatCurrency(todayTotal)}</span>
        </div>
      </div>

      {/* Category Breakdown */}
      <DashboardCard title="By Category">
        {categoryData.length > 0 ? (
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* Donut */}
              <div className="shrink-0 h-28 w-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={52}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || '#ff5722'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      }}
                      itemStyle={{ color: 'var(--color-text-primary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {categoryData.slice(0, 4).map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || '#ff5722' }} />
                      <span className="text-[13px] text-(--color-text-primary) truncate">{entry.name}</span>
                    </div>
                    <span className="text-[12px] font-medium text-(--color-text-secondary) shrink-0">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
                {categoryData.length > 4 && (
                  <p className="text-[11px] text-(--color-text-muted)">+{categoryData.length - 4} more</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 flex items-center justify-center text-(--color-text-muted) text-[14px]">
            No data yet
          </div>
        )}
      </DashboardCard>

      {/* Recent Activity */}
      <DashboardCard title="Recent Activity">
        {recentExpenses.length > 0 ? (
          <div>
            {recentExpenses.map((expense, idx) => {
              const emoji = CATEGORY_EMOJI[expense.category] ?? '💰';
              const dateObj = new Date(expense.date);
              const isToday = dateObj.toDateString() === new Date().toDateString();
              const dateLabel = isToday
                ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              const isLast = idx === recentExpenses.length - 1;

              return (
                <div key={expense.id} className={isLast ? 'border-b-0' : ''}>
                  <div
                    className="kavish-row active:bg-(--color-surface2)"
                    onClick={() => openEditModal(expense)}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-[10px] bg-(--color-surface2) flex items-center justify-center text-[20px] shrink-0 mr-3">
                      {emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-(--color-text-primary) truncate">{expense.category}</p>
                      <p className="text-[13px] text-(--color-text-secondary) truncate">
                        {expense.note || expense.paymentMethod}
                        {expense.accountName ? ` · ${expense.accountName}` : ''}
                      </p>
                    </div>

                    {/* Amount + Date */}
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-[15px] font-medium text-(--color-text-primary)">
                        ₹{expense.amount.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[12px] text-(--color-text-muted)">{dateLabel}</p>
                    </div>

                    {/* Delete trigger */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(confirmDeleteId === expense.id ? null : expense.id); }}
                      className={`ml-3 h-8 w-8 rounded-full flex items-center justify-center transition-colors ${confirmDeleteId === expense.id ? 'text-(--color-red) bg-(--color-red)/10' : 'text-(--color-text-muted) active:text-(--color-red) active:bg-(--color-red)/10'}`}
                      aria-label="Delete"
                    >
                      {deletingId === expense.id ? (
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Inline delete confirmation */}
                  {confirmDeleteId === expense.id && (
                    <div className="mx-4 mb-3 bg-(--color-red)/10 border border-(--color-red)/20 rounded-xl px-4 py-2.5 flex items-center justify-between ios-fade-in">
                      <p className="text-[13px] font-medium text-(--color-red)">Delete this expense?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-(--color-text-secondary) bg-(--color-surface2) active:opacity-70">Cancel</button>
                        <button onClick={() => handleDelete(expense.id)} disabled={!!deletingId} className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-(--color-red) active:opacity-80 disabled:opacity-50">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-(--color-surface2) flex items-center justify-center text-(--color-text-muted)">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <p className="text-[14px] text-(--color-text-secondary)">No expenses in the last 30 days</p>
          </div>
        )}
      </DashboardCard>

    </main>
  );
}
