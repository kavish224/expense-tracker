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
    loading: {
        expenses: boolean;
        accounts: boolean;
        initial: boolean;
    };
    errors: {
        expenses: string | null;
        accounts: string | null;
    };
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
    initializeData: () => Promise<void>;
    openModal: () => void;
    openEditModal: (expense: Expense) => void;
    closeModal: () => void;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
    expenses: [],
    accounts: [],
    user: null,
    loading: { expenses: false, accounts: false, initial: false },
    errors: { expenses: null, accounts: null },
    isModalOpen: false,
    editingExpense: null,

    setUser: (user) => set({ user }),

    loadExpenses: async () => {
        set({ loading: { ...get().loading, expenses: true }, errors: { ...get().errors, expenses: null } });
        try {
            const expenses = await getAllExpenses();
            set({
                expenses: expenses.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                ),
                loading: { ...get().loading, expenses: false }
            });
        } catch (error) {
            set({
                loading: { ...get().loading, expenses: false },
                errors: { ...get().errors, expenses: (error as Error).message }
            });
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
        set({ loading: { ...get().loading, accounts: true }, errors: { ...get().errors, accounts: null } });
        try {
            const accounts = await getAllAccounts();
            set({ accounts, loading: { ...get().loading, accounts: false } });
        } catch (error) {
            set({
                loading: { ...get().loading, accounts: false },
                errors: { ...get().errors, accounts: (error as Error).message }
            });
        }
    },

    addAccount: async (data) => {
        const newAccount = await addAccountToDB(data);
        set({ accounts: [...get().accounts, newAccount] });
    },

    deleteAccount: async (id) => {
        await deleteAccountFromDB(id);
        set({ accounts: get().accounts.filter((a) => a.id !== id) });
    },

    initializeData: async () => {
        set({ loading: { ...get().loading, initial: true } });
        try {
            await Promise.all([get().loadExpenses(), get().loadAccounts()]);
        } finally {
            set({ loading: { ...get().loading, initial: false } });
        }
    },

    openModal: () => set({ isModalOpen: true, editingExpense: null }),
    openEditModal: (expense) => set({ isModalOpen: true, editingExpense: expense }),
    closeModal: () => set({ isModalOpen: false, editingExpense: null }),
}));
