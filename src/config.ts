import "dotenv/config";
import { existsSync } from "node:fs";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}. Copy .env.example → .env and fill values.`);
  }
  return value;
}

const allowedRaw = process.env.ALLOWED_USER_IDS?.trim() ?? "";

export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  geminiApiKey: required("GEMINI_API_KEY"),
  sheetsId: required("GOOGLE_SHEETS_ID"),
  sheetTab: process.env.GOOGLE_SHEET_TAB?.trim() || "Expenses",
  serviceAccountPath:
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH?.trim() || "./credentials/service-account.json",
  allowedUserIds: allowedRaw
    ? allowedRaw.split(",").map((id) => Number(id.trim())).filter(Boolean)
    : [],
};

if (!existsSync(config.serviceAccountPath)) {
  throw new Error(
    `Service account file not found: ${config.serviceAccountPath}. See README → Google Sheets setup.`,
  );
}
