import { readFileSync } from "node:fs";
import { google } from "googleapis";
import { config } from "./config.js";
import type { Expense } from "./types.js";

type ServiceAccount = {
  client_email: string;
  private_key: string;
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

export async function ensureHeaderRow(): Promise<void> {
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const range = `${config.sheetTab}!A1:F1`;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetsId,
    range,
  });

  const first = existing.data.values?.[0];
  if (first?.length) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.sheetsId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [["date", "amount", "currency", "category", "note", "source"]],
    },
  });
}

export async function appendExpense(expense: Expense): Promise<void> {
  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheetsId,
    range: `${config.sheetTab}!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          expense.date,
          expense.amount,
          expense.currency,
          expense.category,
          expense.note,
          expense.source,
        ],
      ],
    },
  });
}
