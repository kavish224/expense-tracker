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

  const recentExpenses = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return [...expenses]
      .filter(e => new Date(e.date) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses]);

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
          <div className="divide-y divide-[var(--color-border2)]/30">
            {recentExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center gap-4 p-4 hover:bg-[var(--color-surface2)] transition-all group cursor-pointer" onClick={() => openEditModal(expense)}>
                <div className="w-10 h-10 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-[18px] opacity-80">
                    {expense.category === 'Food' ? '☕' :
                      expense.category === 'Transport' ? '🚗' :
                        expense.category === 'Shopping' ? '🛍️' :
                          expense.category === 'Entertainment' ? '🎬' :
                            expense.category === 'Bills' ? '📱' :
                              expense.category === 'Health' ? '💊' :
                                expense.category === 'Education' ? '🎓' :
                                  expense.category === 'Travel' ? '✈️' :
                                    expense.category === 'Groceries' ? '🛒' : '💰'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-[14px] text-[var(--color-text-primary)] truncate">{expense.category}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-md font-black uppercase tracking-wider">
                      {expense.paymentMethod}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)] font-medium truncate">
                    {expense.note || 'Regular expense'}{expense.accountName ? ` • ${expense.accountName}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-[15px] font-black tracking-tight ${expense.amount > 1000 ? 'text-[var(--color-red)]' : 'text-[var(--color-text-primary)]'}`}>
                      ₹{expense.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase opacity-60">
                      {new Date(expense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(expense); }}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 active:scale-90 transition-all"
                      aria-label="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this expense?')) {
                          deleteExpense(expense.id);
                        }
                      }}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--color-red)]/10 active:scale-90 transition-all"
                      aria-label="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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
