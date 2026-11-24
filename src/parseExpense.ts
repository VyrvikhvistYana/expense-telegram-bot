import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config.js";
import { EXPENSE_CATEGORIES, type Expense } from "./types.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const SYSTEM = `You extract personal expenses from short Russian or English messages.
Return ONLY valid JSON (no markdown) with keys:
date (YYYY-MM-DD, use today if missing: {{TODAY}}),
amount (number),
currency (ISO code, default RUB),
category (one of: ${EXPENSE_CATEGORIES.join(", ")}),
note (short string, empty if none).
If the message is not an expense, return {"error":"not_an_expense"}.`;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function coerceExpense(raw: unknown, source: Expense["source"]): Expense | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.error) return null;

  const amount = Number(obj.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const category = String(obj.category ?? "other").toLowerCase();
  const safeCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(category)
    ? category
    : "other";

  return {
    date: String(obj.date || todayIso()),
    amount,
    currency: String(obj.currency || "RUB").toUpperCase(),
    category: safeCategory,
    note: String(obj.note ?? "").slice(0, 200),
    source,
  };
}

export async function parseExpenseFromText(
  text: string,
  source: Expense["source"] = "text",
): Promise<Expense | null> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = SYSTEM.replace("{{TODAY}}", todayIso()) + `\n\nMessage:\n${text}`;
  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return coerceExpense(JSON.parse(jsonMatch[0]), source);
  } catch {
    return null;
  }
}
