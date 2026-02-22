'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Expense } from '@/lib/types';
import { addExpenseToDB, getAllExpenses, deleteExpenseFromDB } from '@/lib/db';

interface ExpenseStore {
    expenses: Expense[];
    isLoaded: boolean;
    isModalOpen: boolean;
    loadExpenses: () => Promise<void>;
    addExpense: (data: Omit<Expense, 'id'>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
    openModal: () => void;
    closeModal: () => void;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
    expenses: [],
    isLoaded: false,
    isModalOpen: false,

    loadExpenses: async () => {
        try {
            const expenses = await getAllExpenses();
            set({
                expenses: expenses.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                ),
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
        // Optimistic update
        set({
            expenses: [expense, ...get().expenses],
        });
        await addExpenseToDB(expense);
    },

    deleteExpense: async (id) => {
        // Optimistic update
        set({
            expenses: get().expenses.filter((e) => e.id !== id),
        });
        await deleteExpenseFromDB(id);
    },

    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({ isModalOpen: false }),
}));
