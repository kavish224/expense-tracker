'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Expense, Account } from '@/lib/types';
import {
    addExpenseToDB,
    getAllExpenses,
    deleteExpenseFromDB,
    addAccountToDB,
    getAllAccounts,
    deleteAccountFromDB
} from '@/lib/db';

interface ExpenseStore {
    expenses: Expense[];
    accounts: Account[];
    isLoaded: boolean;
    isModalOpen: boolean;
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
    isLoaded: false,
    isModalOpen: false,

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
        const expense: Expense = {
            ...data,
            id: uuidv4(),
        };
        set({ expenses: [expense, ...get().expenses] });
        await addExpenseToDB(expense);
    },

    deleteExpense: async (id) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
        await deleteExpenseFromDB(id);
    },

    loadAccounts: async () => {
        const accounts = await getAllAccounts();
        set({ accounts });
    },

    addAccount: async (data) => {
        const account: Account = {
            ...data,
            id: uuidv4(),
        };
        set({ accounts: [...get().accounts, account] });
        await addAccountToDB(account);
    },

    deleteAccount: async (id) => {
        set({ accounts: get().accounts.filter((a) => a.id !== id) });
        await deleteAccountFromDB(id);
    },

    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({ isModalOpen: false }),
}));
