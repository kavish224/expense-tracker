import { Expense } from './types';

export function getMonthlyTotal(expenses: Expense[], date?: Date): number {
    const target = date || new Date();
    const month = target.getMonth();
    const year = target.getFullYear();
    return expenses
        .filter((e) => {
            const d = new Date(e.date);
            return d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((sum, e) => sum + e.amount, 0);
}

export function getTodayTotal(expenses: Expense[]): number {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    return expenses
        .filter((e) => e.date.split('T')[0] === todayStr)
        .reduce((sum, e) => sum + e.amount, 0);
}

export function getCategoryTotals(
    expenses: Expense[],
    date?: Date
): { name: string; value: number }[] {
    const target = date || new Date();
    const month = target.getMonth();
    const year = target.getFullYear();

    const filtered = expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    const map = new Map<string, number>();
    filtered.forEach((e) => {
        map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });

    return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}

export function getPaymentMethodTotals(
    expenses: Expense[],
    date?: Date
): { name: string; value: number }[] {
    const target = date || new Date();
    const month = target.getMonth();
    const year = target.getFullYear();

    const filtered = expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    const map = new Map<string, number>();
    filtered.forEach((e) => {
        map.set(e.paymentMethod, (map.get(e.paymentMethod) || 0) + e.amount);
    });

    return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}

export function getMonthlyTrend(
    expenses: Expense[],
    months: number = 6
): { month: string; total: number }[] {
    const now = new Date();
    const result: { month: string; total: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.getMonth();
        const year = d.getFullYear();
        const label = d.toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
        });

        const total = expenses
            .filter((e) => {
                const ed = new Date(e.date);
                return ed.getMonth() === month && ed.getFullYear() === year;
            })
            .reduce((sum, e) => sum + e.amount, 0);

        result.push({ month: label, total });
    }

    return result;
}

export function getDailyAverage(expenses: Expense[], date?: Date): number {
    const target = date || new Date();
    const month = target.getMonth();
    const year = target.getFullYear();

    const filtered = expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    if (filtered.length === 0) return 0;

    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    const today = new Date();
    const dayOfMonth =
        today.getMonth() === month && today.getFullYear() === year
            ? today.getDate()
            : new Date(year, month + 1, 0).getDate();

    return total / dayOfMonth;
}

export function getLargestExpense(
    expenses: Expense[],
    date?: Date
): Expense | null {
    const target = date || new Date();
    const month = target.getMonth();
    const year = target.getFullYear();

    const filtered = expenses.filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    if (filtered.length === 0) return null;

    return filtered.reduce((max, e) => (e.amount > max.amount ? e : max));
}

export function getMonthOverMonthChange(expenses: Expense[]): {
    current: number;
    previous: number;
    change: number;
} {
    const now = new Date();
    const current = getMonthlyTotal(expenses, now);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previous = getMonthlyTotal(expenses, prev);

    const change =
        previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    return { current, previous, change };
}

export function getAccountTotals(
    expenses: Expense[]
): { account: string; paymentMethod: string; total: number }[] {
    const map = new Map<string, { account: string; paymentMethod: string; total: number }>();

    expenses.forEach((e) => {
        const key = `${e.paymentMethod}|${e.account || 'Default'}`;
        const existing = map.get(key);
        if (existing) {
            existing.total += e.amount;
        } else {
            map.set(key, {
                account: e.account || 'Default',
                paymentMethod: e.paymentMethod,
                total: e.amount,
            });
        }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
