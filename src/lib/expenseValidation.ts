import {
    CATEGORIES,
    PAYMENT_METHODS,
    ExpenseCategory,
    ExpenseInput,
    PaymentMethod,
} from './types';

export interface NormalizedExpenseInput {
    amount: number;
    category: ExpenseCategory;
    paymentMethod: PaymentMethod;
    account: string | null;
    date: string;
    note: string | null;
}

const MAX_AMOUNT = 10_000_000;
const MAX_BULK_EXPENSES = 50;

const validCategories = new Set<ExpenseCategory>(CATEGORIES);
const validPaymentMethods = new Set<PaymentMethod>(PAYMENT_METHODS);

function isExpenseCategory(value: unknown): value is ExpenseCategory {
    return typeof value === 'string' && validCategories.has(value as ExpenseCategory);
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
    return typeof value === 'string' && validPaymentMethods.has(value as PaymentMethod);
}

export function validateExpenseInput(input: unknown): { ok: true; value: NormalizedExpenseInput } | { ok: false; error: string } {
    if (!input || typeof input !== 'object') {
        return { ok: false, error: 'Invalid expense payload' };
    }

    const raw = input as Partial<ExpenseInput>;
    const parsedAmount = Number(raw.amount);
    if (!isFinite(parsedAmount) || parsedAmount <= 0) {
        return { ok: false, error: 'Amount must be a positive number' };
    }
    if (parsedAmount > MAX_AMOUNT) {
        return { ok: false, error: 'Amount exceeds maximum allowed value' };
    }
    if (!isExpenseCategory(raw.category)) {
        return { ok: false, error: 'Invalid category' };
    }
    if (!isPaymentMethod(raw.paymentMethod)) {
        return { ok: false, error: 'Invalid payment method' };
    }
    if (!raw.date || isNaN(Date.parse(raw.date))) {
        return { ok: false, error: 'Invalid date' };
    }

    const note = typeof raw.note === 'string' ? raw.note.trim() : '';
    if (note.length > 200) {
        return { ok: false, error: 'Note is too long (max 200 characters)' };
    }

    const account = typeof raw.account === 'string' && raw.account.trim().length > 0
        ? raw.account.trim()
        : null;

    return {
        ok: true,
        value: {
            amount: parsedAmount,
            category: raw.category,
            paymentMethod: raw.paymentMethod,
            account,
            date: new Date(raw.date).toISOString(),
            note: note || null,
        },
    };
}

export function validateBulkExpenseInput(input: unknown): { ok: true; value: NormalizedExpenseInput[] } | { ok: false; error: string } {
    if (!Array.isArray(input) || input.length === 0) {
        return { ok: false, error: 'Add at least one expense' };
    }

    if (input.length > MAX_BULK_EXPENSES) {
        return { ok: false, error: `You can add up to ${MAX_BULK_EXPENSES} expenses at once` };
    }

    const normalized: NormalizedExpenseInput[] = [];
    for (let index = 0; index < input.length; index += 1) {
        const result = validateExpenseInput(input[index]);
        if (!result.ok) {
            return { ok: false, error: `Expense ${index + 1}: ${result.error}` };
        }
        normalized.push(result.value);
    }

    return { ok: true, value: normalized };
}
