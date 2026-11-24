export type Expense = {
  date: string;
  amount: number;
  currency: string;
  category: string;
  note: string;
  source: "text" | "voice";
};

export const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "home",
  "health",
  "fun",
  "shopping",
  "bills",
  "other",
] as const;
