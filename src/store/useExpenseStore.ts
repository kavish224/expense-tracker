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
            throw error;
        }
    },

    addExpense: async (data) => {
        // Optimistic insert with a temp id so UI responds immediately
        const tempId = `temp-${Date.now()}`;
        const optimistic: Expense = { id: tempId, ...data };
        set({
            expenses: [optimistic, ...get().expenses].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        });
        try {
            const newExpense = await addExpenseToDB(data);
            // Replace temp with real record
            set({
                expenses: get().expenses
                    .map(e => e.id === tempId ? newExpense : e)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            });
        } catch (error) {
            // Rollback on failure
            set({ expenses: get().expenses.filter(e => e.id !== tempId) });
            throw error;
        }
    },

    updateExpense: async (id, data) => {
        // Snapshot for rollback
        const prev = get().expenses;
        set({
            expenses: prev
                .map(e => e.id === id ? { ...e, ...data } : e)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        });
        try {
            const updated = await updateExpenseInDB(id, data);
            set({
                expenses: get().expenses
                    .map(e => e.id === id ? updated : e)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            });
        } catch (error) {
            set({ expenses: prev });
            throw error;
        }
    },

    deleteExpense: async (id) => {
        // Optimistic remove
        const prev = get().expenses;
        set({ expenses: prev.filter(e => e.id !== id) });
        try {
            await deleteExpenseFromDB(id);
        } catch (error) {
            set({ expenses: prev });
            throw error;
        }
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
            throw error;
        }
    },

    addAccount: async (data) => {
        const newAccount = await addAccountToDB(data);
        set({ accounts: [...get().accounts, newAccount] });
    },

    deleteAccount: async (id) => {
        const prev = get().accounts;
        set({ accounts: prev.filter(a => a.id !== id) });
        try {
            await deleteAccountFromDB(id);
        } catch (error) {
            set({ accounts: prev });
            throw error;
        }
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
