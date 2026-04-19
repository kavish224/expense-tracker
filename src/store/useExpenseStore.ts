'use client';

import { create } from 'zustand';
import { Expense, Account, ExpenseInput } from '@/lib/types';
import {
    addExpenseToDB,
    addExpensesBulkToDB,
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
    addExpense: (data: ExpenseInput) => Promise<void>;
    addExpensesBulk: (items: ExpenseInput[]) => Promise<void>;
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

const sortExpensesByDateDesc = (expenses: Expense[]) => (
    [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
);

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
                expenses: sortExpensesByDateDesc(expenses),
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
        const optimistic: Expense = {
            id: tempId,
            ...data,
            accountName: data.account ? get().accounts.find((account) => account.id === data.account)?.name : undefined,
        };
        set({
            expenses: sortExpensesByDateDesc([optimistic, ...get().expenses])
        });
        try {
            const newExpense = await addExpenseToDB(data);
            // Replace temp with real record
            set({
                expenses: sortExpensesByDateDesc(
                    get().expenses.map(e => e.id === tempId ? newExpense : e)
                )
            });
        } catch (error) {
            // Rollback on failure
            set({ expenses: get().expenses.filter(e => e.id !== tempId) });
            throw error;
        }
    },

    addExpensesBulk: async (items) => {
        const timestamp = Date.now();
        const tempIds = items.map((_, index) => `temp-${timestamp}-${index}`);
        const optimisticExpenses: Expense[] = items.map((item, index) => ({
            id: tempIds[index],
            ...item,
            accountName: item.account ? get().accounts.find((account) => account.id === item.account)?.name : undefined,
        }));

        set({
            expenses: sortExpensesByDateDesc([...optimisticExpenses, ...get().expenses]),
        });

        try {
            const createdExpenses = await addExpensesBulkToDB(items);
            const createdByTempId = new Map(tempIds.map((tempId, index) => [tempId, createdExpenses[index]]));
            set({
                expenses: sortExpensesByDateDesc(
                    get().expenses.map((expense) => createdByTempId.get(expense.id) ?? expense)
                ),
            });
        } catch (error) {
            const tempIdSet = new Set(tempIds);
            set({ expenses: get().expenses.filter((expense) => !tempIdSet.has(expense.id)) });
            throw error;
        }
    },

    updateExpense: async (id, data) => {
        // Snapshot for rollback
        const prev = get().expenses;
        set({
            expenses: sortExpensesByDateDesc(
                prev.map(e => e.id === id ? { ...e, ...data } : e)
            )
        });
        try {
            const updated = await updateExpenseInDB(id, data);
            set({
                expenses: sortExpensesByDateDesc(
                    get().expenses.map(e => e.id === id ? updated : e)
                )
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
