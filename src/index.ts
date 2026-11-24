import { Bot } from "grammy";
import { config } from "./config.js";
import { parseExpenseFromText } from "./parseExpense.js";
import { appendExpense, ensureHeaderRow } from "./sheets.js";
import { transcribeVoice } from "./voice.js";
import type { Expense } from "./types.js";

const bot = new Bot(config.telegramToken);

function isAllowed(userId: number | undefined): boolean {
  if (!config.allowedUserIds.length) return true;
  if (!userId) return false;
  return config.allowedUserIds.includes(userId);
}

function formatExpense(e: Expense): string {
  const note = e.note ? ` — ${e.note}` : "";
  return `✅ ${e.date} · ${e.amount} ${e.currency} · ${e.category}${note}\nИсточник: ${e.source}`;
}

async function saveFromText(
  text: string,
  source: Expense["source"],
): Promise<{ ok: true; expense: Expense } | { ok: false; reason: string }> {
  const expense = await parseExpenseFromText(text, source);
  if (!expense) {
    return { ok: false, reason: "Не похоже на расход. Пример: «кофе 250» или «такси 400 вчера»." };
  }
  await appendExpense(expense);
  return { ok: true, expense };
}

bot.command("start", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) {
    await ctx.reply("Бот приватный. Добавь свой Telegram ID в ALLOWED_USER_IDS.");
    return;
  }
  await ctx.reply(
    [
      "👋 Expense bot — голос или текст → Google Sheets.",
      "",
      "Примеры:",
      "• кофе 250",
      "• такси 450 вчера",
      "• продукты 3200 руб",
      "",
      "Или просто пришли голосовое.",
      "",
      "/help — кратко",
      "/ping — проверка",
    ].join("\n"),
  );
});

bot.command("help", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;
  await ctx.reply(
    "Текст или голос с суммой и категорией. Данные пишутся в таблицу Expenses (date, amount, currency, category, note, source).",
  );
});

bot.command("ping", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;
  await ctx.reply("pong");
});

bot.on("message:text", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;

  await ctx.replyWithChatAction("typing");
  try {
    const result = await saveFromText(text, "text");
    if (!result.ok) {
      await ctx.reply(result.reason);
      return;
    }
    await ctx.reply(formatExpense(result.expense));
  } catch (err) {
    console.error(err);
    await ctx.reply("Ошибка при сохранении. Проверь логи и доступ service account к таблице.");
  }
});

bot.on("message:voice", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;

  await ctx.replyWithChatAction("typing");
  try {
    const file = await ctx.getFile();
    if (!file.file_path) {
      await ctx.reply("Не удалось скачать голосовое.");
      return;
    }
    const url = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const transcript = await transcribeVoice(buffer, "audio/ogg");
    if (!transcript) {
      await ctx.reply("Не разобрала голос. Попробуй ещё раз или напиши текстом.");
      return;
    }

    const result = await saveFromText(transcript, "voice");
    if (!result.ok) {
      await ctx.reply(`Распознала: «${transcript}»\n\n${result.reason}`);
      return;
    }
    await ctx.reply(`🎤 «${transcript}»\n\n${formatExpense(result.expense)}`);
  } catch (err) {
    console.error(err);
    await ctx.reply("Ошибка при обработке голоса. Смотри логи сервера.");
  }
});

async function main() {
  await ensureHeaderRow();
  console.log("Sheets header OK. Starting bot (long polling)…");
  await bot.start({
    onStart: (info) => console.log(`Bot @${info.username} is running`),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
