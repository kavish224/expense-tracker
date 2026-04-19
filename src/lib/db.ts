import { Expense, Account, ExpenseInput } from './types';

// ================= Expenses =================

export async function addExpenseToDB(expense: ExpenseInput): Promise<Expense> {
    const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
    });
    if (!res.ok) throw new Error('Failed to add expense');
    return res.json();
}

export async function addExpensesBulkToDB(expenses: ExpenseInput[]): Promise<Expense[]> {
    const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses }),
    });
    if (!res.ok) throw new Error('Failed to add expenses');
    return res.json();
}

export async function getAllExpenses(): Promise<Expense[]> {
    const res = await fetch('/api/expenses');
    if (!res.ok) throw new Error('Failed to fetch expenses');
    return res.json();
}

export async function deleteExpenseFromDB(id: string): Promise<void> {
    const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete expense');
}

export async function updateExpenseInDB(id: string, expense: Partial<Expense>): Promise<Expense> {
    const res = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
    });
    if (!res.ok) throw new Error('Failed to update expense');
    return res.json();
}

// ================= Accounts =================

export async function addAccountToDB(account: Omit<Account, 'id'>): Promise<Account> {
    const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
    });
    if (!res.ok) throw new Error('Failed to add account');
    return res.json();
}

export async function getAllAccounts(): Promise<Account[]> {
    const res = await fetch('/api/accounts');
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
}

export async function deleteAccountFromDB(id: string): Promise<void> {
    const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete account');
}
