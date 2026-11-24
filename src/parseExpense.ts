import { generateWithFallback } from "./gemini.js";
import { CATEGORY_ALIASES, EXPENSE_CATEGORIES, type Expense } from "./types.js";

const SYSTEM = `Ты извлекаешь личные расходы из коротких сообщений на русском или английском.
Верни ТОЛЬКО валидный JSON (без markdown) с ключами:
date (YYYY-MM-DD, если даты нет — используй сегодня: {{TODAY}}),
amount (число),
currency (ISO-код, по умолчанию RUB),
category (строго одно из списка категорий ниже — верни ТОЧНУЮ строку из списка),
note (короткая строка, иначе пустая).

Категории (точные имена колонок таблицы):
${EXPENSE_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Подсказки:
- кофе/продукты/ресторан → Еда
- куртка себе → одежда
- вещи ребёнку → Олежда детей
- секция/врач ребёнка → Кружки/медицина_детей
- жкх/ипотека/страховка → коммуналка/ипотекаи/страховки
- карманные детям → караманные расходы детей

Если сообщение не про расход, верни {"error":"not_an_expense"}.`;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCategory(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if ((EXPENSE_CATEGORIES as readonly string[]).includes(value)) return value;

  const lower = value.toLowerCase();
  const byExactLower = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (byExactLower) return byExactLower;

  return CATEGORY_ALIASES[lower] ?? CATEGORY_ALIASES[value] ?? "Еда";
}

function coerceExpense(raw: unknown, source: Expense["source"]): Expense | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.error) return null;

  const amount = Number(obj.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    date: String(obj.date || todayIso()),
    amount,
    currency: String(obj.currency || "RUB").toUpperCase(),
    category: normalizeCategory(obj.category),
    note: String(obj.note ?? "").slice(0, 200),
    source,
  };
}

export async function parseExpenseFromText(
  text: string,
  source: Expense["source"] = "текст",
): Promise<Expense | null> {
  const prompt = SYSTEM.replace("{{TODAY}}", todayIso()) + `\n\nСообщение:\n${text}`;
  const rawText = await generateWithFallback((model) => model.generateContent(prompt));
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return coerceExpense(JSON.parse(jsonMatch[0]), source);
  } catch {
    return null;
  }
}
