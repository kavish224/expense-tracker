export const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills',
  'Health',
  'Education',
  'Travel',
  'Groceries',
  'Other',
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Credit Card',
  'Debit Card',
  'Net Banking',
  'Wallet',
] as const;

export type ExpenseCategory = typeof CATEGORIES[number];
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export interface ExpenseInput {
  amount: number;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  account?: string; // This holds the account id (UUID)
  date: string; // ISO string
  note?: string;
}

export interface Expense extends ExpenseInput {
  id: string;
  accountName?: string; // This holds the human-readable account name
}

export const CATEGORY_COLORS: Record<string, string> = {
  Food: '#FF6B6B',
  Transport: '#4ECDC4',
  Shopping: '#45B7D1',
  Entertainment: '#96CEB4',
  Bills: '#FFEAA7',
  Health: '#DDA0DD',
  Education: '#98D8C8',
  Travel: '#F7DC6F',
  Groceries: '#82E0AA',
  Other: '#AEB6BF',
};

export interface Account {
  id: string;
  name: string;
  type: 'Bank' | 'CreditCard';
}
