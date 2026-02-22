'use client';

import { useMemo } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import {
  getMonthlyTotal,
  getTodayTotal,
  getCategoryTotals,
  getPaymentMethodTotals,
  formatCurrency,
} from '@/lib/calculations';
import { CATEGORY_COLORS } from '@/lib/types';
import DashboardCard from '@/components/DashboardCard';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const PM_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];

export default function DashboardPage() {
  const { expenses, isLoaded, deleteExpense } = useExpenseStore();

  const monthlyTotal = useMemo(() => getMonthlyTotal(expenses), [expenses]);
  const todayTotal = useMemo(() => getTodayTotal(expenses), [expenses]);
  const categoryTotals = useMemo(() => getCategoryTotals(expenses), [expenses]);
  const paymentMethodTotals = useMemo(
    () => getPaymentMethodTotals(expenses),
    [expenses]
  );

  const recentExpenses = useMemo(
    () => expenses.slice(0, 10),
    [expenses]
  );

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard title="This Month">
          <p className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">
            {formatCurrency(monthlyTotal)}
          </p>
        </DashboardCard>
        <DashboardCard title="Today">
          <p className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">
            {formatCurrency(todayTotal)}
          </p>
        </DashboardCard>
      </div>

      {/* Category breakdown donut */}
      {categoryTotals.length > 0 && (
        <DashboardCard title="By Category">
          <div className="flex items-center gap-4">
            <div className="h-40 w-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryTotals}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryTotals.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_COLORS[entry.name] || '#AEB6BF'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                    contentStyle={{
                      backgroundColor: '#1e2235',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 text-xs min-w-0">
              {categoryTotals.slice(0, 5).map((cat) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[cat.name] || '#AEB6BF',
                    }}
                  />
                  <span className="truncate text-gray-600 dark:text-gray-300">
                    {cat.name}
                  </span>
                  <span className="ml-auto font-medium text-gray-800 dark:text-white whitespace-nowrap">
                    {formatCurrency(cat.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Payment method donut */}
      {paymentMethodTotals.length > 0 && (
        <DashboardCard title="By Payment Method">
          <div className="flex items-center gap-4">
            <div className="h-40 w-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodTotals}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {paymentMethodTotals.map((_, index) => (
                      <Cell
                        key={index}
                        fill={PM_COLORS[index % PM_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                    contentStyle={{
                      backgroundColor: '#1e2235',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 text-xs min-w-0">
              {paymentMethodTotals.map((pm, index) => (
                <div key={pm.name} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{
                      backgroundColor: PM_COLORS[index % PM_COLORS.length],
                    }}
                  />
                  <span className="truncate text-gray-600 dark:text-gray-300">
                    {pm.name}
                  </span>
                  <span className="ml-auto font-medium text-gray-800 dark:text-white whitespace-nowrap">
                    {formatCurrency(pm.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Recent expenses */}
      <DashboardCard title="Recent Expenses">
        {recentExpenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-500">
            No expenses yet. Tap + to add one!
          </p>
        ) : (
          <div className="space-y-0.5">
            {recentExpenses.map((expense) => (
              <div
                key={expense.id}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[expense.category] || '#AEB6BF',
                  }}
                >
                  {expense.category.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {expense.category}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {expense.paymentMethod}
                    {expense.note && ` · ${expense.note}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {formatCurrency(expense.amount)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {new Date(expense.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="ml-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400"
                  aria-label="Delete expense"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
