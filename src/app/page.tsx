'use client';

import { useExpenseStore } from '@/store/useExpenseStore';
import DashboardCard from '@/components/DashboardCard';
import {
  getMonthlyTotal,
  getTodayTotal,
  getCategoryTotals,
  getPaymentMethodTotals,
  formatCurrency,
} from '@/lib/calculations';
import { CATEGORY_COLORS } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useMemo } from 'react';

export default function Dashboard() {
  const expenses = useExpenseStore((s) => s.expenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const openEditModal = useExpenseStore((s) => s.openEditModal);

  const monthlyTotal = useMemo(() => getMonthlyTotal(expenses), [expenses]);
  const todayTotal = useMemo(() => getTodayTotal(expenses), [expenses]);
  const categoryData = useMemo(() => getCategoryTotals(expenses), [expenses]);
  const paymentMethodData = useMemo(() => getPaymentMethodTotals(expenses), [expenses]);

  const recentExpenses = useMemo(() =>
    [...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10),
    [expenses]
  );

  return (
    <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* kavish Style Key Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="kavish-card p-4">
          <p className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium mb-1">
            this month
          </p>
          <p className="text-[22px] font-semibold text-[var(--color-text-primary)]">
            {formatCurrency(monthlyTotal)}
          </p>
        </div>
        <div className="kavish-card p-4">
          <p className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium mb-1">
            today's spend
          </p>
          <p className="text-[22px] font-semibold text-[var(--color-text-primary)]">
            {formatCurrency(todayTotal)}
          </p>
        </div>
      </div>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 gap-6">
        <DashboardCard title="By Category">
          <div className="h-48 w-full">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
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
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)]">
                No categorical data
              </div>
            )}
          </div>
        </DashboardCard>

        <DashboardCard title="Funds (By Method)">
          <div className="h-48 w-full">
            {paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentMethodData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={['#ff5722', '#e05d4b', '#cc4a38', '#ff8a65'][index % 4]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)]">
                No payment data
              </div>
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Recent Activity (kavish Marketwatch/Holdings Style) */}
      <DashboardCard title="Recent Activity" className="!p-0 overflow-hidden">
        {recentExpenses.length > 0 ? (
          <div>
            {recentExpenses.map((expense) => (
              <div key={expense.id} className="kavish-row group">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-[13px]">{expense.category}</span>
                    <span className="text-[11px] px-1.5 py-0.5 bg-[var(--color-surface2)] text-[var(--color-text-secondary)] rounded-sm font-medium">
                      {expense.paymentMethod}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    {new Date(expense.date).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })} • {expense.note || 'No note'}{expense.accountName ? ` • ${expense.accountName}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-[13px] ${expense.amount > 1000 ? 'kavish-red' : 'kavish-green'}`}>
                    ₹{expense.amount.toLocaleString('en-IN')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(expense)}
                      className="md:opacity-0 md:group-hover:opacity-100 h-8 w-8 rounded-full bg-[var(--color-surface2)] md:bg-transparent flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 active:scale-95 transition-all"
                      aria-label="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="md:opacity-0 md:group-hover:opacity-100 h-8 w-8 rounded-full bg-[var(--color-surface2)] md:bg-transparent flex items-center justify-center text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-red-500/10 active:scale-95 transition-all"
                      aria-label="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[var(--color-surface2)] flex items-center justify-center text-[var(--color-text-muted)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-[var(--color-text-secondary)] text-[13px]">No expenses recorded yet.</p>
          </div>
        )}
      </DashboardCard>
    </main>
  );
}
