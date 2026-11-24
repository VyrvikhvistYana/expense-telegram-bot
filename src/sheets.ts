import { readFileSync } from "node:fs";
import { google, sheets_v4 } from "googleapis";
import { config } from "./config.js";
import type { Expense } from "./types.js";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

type MatrixLayout = {
  sheetTitle: string;
  headerRowIndex: number;
  /** category name → 0-based column index */
  categoryColumns: Map<string, number>;
  /** DD.MM.YYYY → 0-based row index */
  dateRows: Map<string, number>;
};

function getAuth() {
  const raw = readFileSync(config.serviceAccountPath, "utf8");
  const sa = JSON.parse(raw) as ServiceAccount;
  return new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheetRange(sheetTitle: string, a1: string): string {
  const tab = sheetTitle.replace(/'/g, "''");
  return `'${tab}'!${a1}`;
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** YYYY-MM-DD → DD.MM.YYYY как в таблице */
export function toSheetDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function parseNumberCell(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

async function resolveSheetTitle(
  sheets: sheets_v4.Sheets,
): Promise<string> {
  if (config.sheetTab) return config.sheetTab;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.sheetsId,
    fields: "sheets.properties.title",
  });
  const title = meta.data.sheets?.[0]?.properties?.title;
  if (!title) throw new Error("В таблице нет ни одного листа");
  return title;
}

async function loadLayout(sheets: sheets_v4.Sheets): Promise<MatrixLayout> {
  const sheetTitle = await resolveSheetTitle(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetsId,
    range: sheetRange(sheetTitle, "A1:Z80"),
  });
  const rows = res.data.values ?? [];

  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i]?.[0] ?? "")
      .trim()
      .toLowerCase();
    if (cell.startsWith("дата")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) {
    throw new Error('Не найдена строка заголовков с колонкой "Дата"');
  }

  const header = rows[headerRowIndex] ?? [];
  const categoryColumns = new Map<string, number>();
  for (let c = 1; c < header.length; c++) {
    const name = String(header[c] ?? "").trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (lower === "доходы" || lower === "на начало месяца") continue;
    categoryColumns.set(name, c);
  }

  const dateRows = new Map<string, number>();
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const raw = String(rows[r]?.[0] ?? "").trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      dateRows.set(raw, r);
    }
  }

  return { sheetTitle, headerRowIndex, categoryColumns, dateRows };
}

function findCategoryColumn(
  layout: MatrixLayout,
  category: string,
): number | undefined {
  if (layout.categoryColumns.has(category)) {
    return layout.categoryColumns.get(category);
  }
  const lower = category.toLowerCase();
  for (const [name, idx] of layout.categoryColumns) {
    if (name.toLowerCase() === lower) return idx;
  }
  return undefined;
}

/** Добавляет сумму в ячейку дата × категория (суммирует с уже записанным). */
export async function addExpenseToMatrix(expense: Expense): Promise<{
  sheetDate: string;
  cell: string;
  previous: number;
  next: number;
}> {
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const layout = await loadLayout(sheets);

  const sheetDate = toSheetDate(expense.date);
  const rowIndex = layout.dateRows.get(sheetDate);
  if (rowIndex === undefined) {
    throw new Error(
      `В таблице нет строки с датой ${sheetDate}. Есть только даты месяца в листе.`,
    );
  }

  const colIndex = findCategoryColumn(layout, expense.category);
  if (colIndex === undefined) {
    const known = [...layout.categoryColumns.keys()].join(", ");
    throw new Error(`Нет колонки «${expense.category}». Доступны: ${known}`);
  }

  const a1 = `${colLetter(colIndex)}${rowIndex + 1}`;
  const range = sheetRange(layout.sheetTitle, a1);
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetsId,
    range,
  });
  const previous = parseNumberCell(current.data.values?.[0]?.[0]);
  const next = previous + expense.amount;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.sheetsId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[next]] },
  });

  return { sheetDate, cell: a1, previous, next };
}
