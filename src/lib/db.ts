import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Expense } from './types';

interface ExpenseDB extends DBSchema {
    expenses: {
        key: string;
        value: Expense;
        indexes: {
            'by-date': string;
            'by-category': string;
        };
    };
}

const DB_NAME = 'expense-tracker-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ExpenseDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ExpenseDB>> {
    if (!dbPromise) {
        dbPromise = openDB<ExpenseDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('expenses', { keyPath: 'id' });
                store.createIndex('by-date', 'date');
                store.createIndex('by-category', 'category');
            },
        });
    }
    return dbPromise;
}

export async function addExpenseToDB(expense: Expense): Promise<void> {
    const db = await getDB();
    await db.put('expenses', expense);
}

export async function getAllExpenses(): Promise<Expense[]> {
    const db = await getDB();
    return db.getAll('expenses');
}

export async function deleteExpenseFromDB(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('expenses', id);
}

export async function getExpenseById(id: string): Promise<Expense | undefined> {
    const db = await getDB();
    return db.get('expenses', id);
}
