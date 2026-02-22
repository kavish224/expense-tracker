'use client';

import { create } from 'zustand';
import { Expense, Account } from '@/lib/types';
import {
    addExpenseToDB,
    getAllExpenses,
    deleteExpenseFromDB,
    addAccountToDB,
    getAllAccounts,
    deleteAccountFromDB
} from '@/lib/db';

interface User {
    id: string;
    email: string;
}

interface ExpenseStore {
    expenses: Expense[];
    accounts: Account[];
    user: User | null;
    isLoaded: boolean;
    isModalOpen: boolean;
    setUser: (user: User | null) => void;
    loadExpenses: () => Promise<void>;
    addExpense: (data: Omit<Expense, 'id'>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
    loadAccounts: () => Promise<void>;
    addAccount: (data: Omit<Account, 'id'>) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;
    openModal: () => void;
    closeModal: () => void;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
    expenses: [],
    accounts: [],
    user: null,
    isLoaded: false,
    isModalOpen: false,

    setUser: (user) => set({ user }),

    loadExpenses: async () => {
        try {
            const [expenses, accounts] = await Promise.all([
                getAllExpenses(),
                getAllAccounts()
            ]);
            set({
                expenses: expenses.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                ),
                accounts,
                isLoaded: true,
            });
        } catch {
            set({ isLoaded: true });
        }
    },

    addExpense: async (data) => {
        // Wait for DB to return the expense so we get the real Postgres UUID + Date
        const newExpense = await addExpenseToDB(data);
        set({ expenses: [newExpense, ...get().expenses] });
    },

    deleteExpense: async (id) => {
        await deleteExpenseFromDB(id);
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
    },

    loadAccounts: async () => {
        const accounts = await getAllAccounts();
        set({ accounts });
    },

    addAccount: async (data) => {
        const newAccount = await addAccountToDB(data);
        set({ accounts: [...get().accounts, newAccount] });
    },

    deleteAccount: async (id) => {
        await deleteAccountFromDB(id);
        set({ accounts: get().accounts.filter((a) => a.id !== id) });
    },

    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({ isModalOpen: false }),
}));
