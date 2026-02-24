'use client';

import { create } from 'zustand';
import { Expense, Account } from '@/lib/types';
import {
    addExpenseToDB,
    updateExpenseInDB,
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
    editingExpense: Expense | null;
    setUser: (user: User | null) => void;
    loadExpenses: () => Promise<void>;
    addExpense: (data: Omit<Expense, 'id'>) => Promise<void>;
    updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
    loadAccounts: () => Promise<void>;
    addAccount: (data: Omit<Account, 'id'>) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;
    openModal: () => void;
    openEditModal: (expense: Expense) => void;
    closeModal: () => void;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
    expenses: [],
    accounts: [],
    user: null,
    isLoaded: false,
    isModalOpen: false,
    editingExpense: null,

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
        const newExpense = await addExpenseToDB(data);
        set({
            expenses: [newExpense, ...get().expenses].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        });
    },

    updateExpense: async (id, data) => {
        const updatedExpense = await updateExpenseInDB(id, data);
        set({
            expenses: get().expenses.map((e) => (e.id === id ? updatedExpense : e)).sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            ),
        });
    },

    deleteExpense: async (id) => {
        await deleteExpenseFromDB(id);
        const filtered = get().expenses.filter((e) => e.id !== id);
        set({ expenses: filtered });
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

    openModal: () => set({ isModalOpen: true, editingExpense: null }),
    openEditModal: (expense) => set({ isModalOpen: true, editingExpense: expense }),
    closeModal: () => set({ isModalOpen: false, editingExpense: null }),
}));
