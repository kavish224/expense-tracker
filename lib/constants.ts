// Shared constants: category catalog + seed account definitions.

export interface CategoryDef {
  key: string;
  name: string;
  colorToken: string; // matches --c-* CSS var suffix
  icon: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: "food", name: "Food & Dining", colorToken: "food", icon: "🍽" },
  { key: "grocery", name: "Groceries", colorToken: "grocery", icon: "🛒" },
  { key: "transport", name: "Transport", colorToken: "transport", icon: "🚕" },
  { key: "shopping", name: "Shopping", colorToken: "shop", icon: "🛍" },
  { key: "bills", name: "Bills & Utilities", colorToken: "bills", icon: "💡" },
  { key: "health", name: "Health", colorToken: "health", icon: "➕" },
  { key: "entertainment", name: "Entertainment", colorToken: "ent", icon: "🎬" },
  { key: "income", name: "Income", colorToken: "income", icon: "↓" },
  { key: "misc", name: "Miscellaneous", colorToken: "misc", icon: "•" },
];

export const CATEGORY_BY_KEY: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
);

export function colorVar(token: string): string {
  return `var(--c-${token})`;
}

export interface AccountSeed {
  name: string;
  type: "BANK" | "CREDIT_CARD" | "CASH";
  institution?: string;
  identifierHint?: string;
  colorToken: string;
  icon: string;
}

export const ACCOUNT_SEEDS: AccountSeed[] = [
  { name: "HDFC Bank", type: "BANK", institution: "HDFC", identifierHint: "1234", colorToken: "transport", icon: "🏦" },
  { name: "ICICI Bank", type: "BANK", institution: "ICICI", identifierHint: "5678", colorToken: "shop", icon: "🏦" },
  { name: "SBI", type: "BANK", institution: "SBIN", identifierHint: "9012", colorToken: "ent", icon: "🏦" },
  { name: "Bank of Baroda", type: "BANK", institution: "BARB", identifierHint: "3456", colorToken: "grocery", icon: "🏦" },
  { name: "AU Kiwi RuPay", type: "CREDIT_CARD", institution: "AU", identifierHint: "7788", colorToken: "food", icon: "💳" },
  { name: "ICICI Amazon Pay", type: "CREDIT_CARD", institution: "ICICI", identifierHint: "4455", colorToken: "bills", icon: "💳" },
  { name: "HDFC RuPay", type: "CREDIT_CARD", institution: "HDFC", identifierHint: "2233", colorToken: "health", icon: "💳" },
  { name: "Cash", type: "CASH", colorToken: "misc", icon: "💵" },
];
