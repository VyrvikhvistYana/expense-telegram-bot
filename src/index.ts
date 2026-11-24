import { Bot } from "grammy";
import { config } from "./config.js";
import { parseExpenseFromText } from "./parseExpense.js";
import { addExpenseToMatrix, toSheetDate } from "./sheets.js";
import { transcribeVoice } from "./voice.js";
import { EXPENSE_CATEGORIES, type Expense } from "./types.js";

const bot = new Bot(config.telegramToken);

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

function isAllowed(userId: number | undefined): boolean {
  if (!config.allowedUserIds.length) return true;
  if (!userId) return false;
  return config.allowedUserIds.includes(userId);
}

function formatExpense(
  e: Expense,
  meta?: { sheetDate: string; cell: string; previous: number; next: number },
): string {
  const note = e.note ? ` — ${e.note}` : "";
  const lines = [
    `✅ ${meta?.sheetDate ?? toSheetDate(e.date)} · ${e.amount} ${e.currency} · ${e.category}${note}`,
    `Источник: ${e.source}`,
  ];
  if (meta) {
    lines.push(`Ячейка ${meta.cell}: ${meta.previous || "пусто"} → ${meta.next}`);
  }
  return lines.join("\n");
}

async function saveFromText(
  text: string,
  source: Expense["source"],
): Promise<
  | { ok: true; expense: Expense; meta: Awaited<ReturnType<typeof addExpenseToMatrix>> }
  | { ok: false; reason: string }
> {
  const expense = await parseExpenseFromText(text, source);
  if (!expense) {
    return {
      ok: false,
      reason:
        "Не похоже на расход. Пример: «кофе 250» или «1 декабря одежда детям 3000».\n" +
        `Категории: ${EXPENSE_CATEGORIES.join(", ")}`,
    };
  }
  const meta = await addExpenseToMatrix(expense);
  return { ok: true, expense, meta };
}

bot.command("start", async (ctx) => {
  console.log("incoming /start from", ctx.from?.id);
  if (!isAllowed(ctx.from?.id)) {
    await ctx.reply("Бот приватный. Добавь свой Telegram ID в ALLOWED_USER_IDS.");
    return;
  }
  await ctx.reply(
    [
      "👋 Expense bot — голос/текст → ячейка в Google Sheets (дата × категория).",
      "",
      "Примеры:",
      "• кофе 250",
      "• 5 декабря подарки 1500",
      "• кружок ребёнку 2000",
      "",
      "Или голосовое.",
      "",
      "/help — категории",
      "/ping — проверка",
    ].join("\n"),
  );
});

bot.command("help", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;
  await ctx.reply(
    [
      "Пишет сумму в твою матрицу: строка даты + колонка категории (прибавляет к уже стоящему числу).",
      "",
      "Категории:",
      ...EXPENSE_CATEGORIES.map((c) => `• ${c}`),
    ].join("\n"),
  );
});

bot.command("ping", async (ctx) => {
  console.log("incoming /ping from", ctx.from?.id);
  if (!isAllowed(ctx.from?.id)) return;
  await ctx.reply("pong");
});

bot.on("message:text", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;

  console.log("incoming text from", ctx.from?.id, text.slice(0, 80));
  await ctx.reply("⏳ Обрабатываю…");
  try {
    const result = await saveFromText(text, "текст");
    if (!result.ok) {
      await ctx.reply(result.reason);
      return;
    }
    await ctx.reply(formatExpense(result.expense, result.meta));
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Ошибка при сохранении";
    await ctx.reply(`${message}\nПроверь service account (доступ Редактор) и даты в таблице.`);
  }
});

bot.on("message:voice", async (ctx) => {
  if (!isAllowed(ctx.from?.id)) return;

  console.log("incoming voice from", ctx.from?.id);
  await ctx.reply("⏳ Слушаю голосовое…");
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

    const result = await saveFromText(transcript, "голос");
    if (!result.ok) {
      await ctx.reply(`Распознала: «${transcript}»\n\n${result.reason}`);
      return;
    }
    await ctx.reply(`🎤 «${transcript}»\n\n${formatExpense(result.expense, result.meta)}`);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Ошибка при обработке голоса";
    await ctx.reply(message);
  }
});

async function main() {
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  console.log("Starting bot (long polling)… matrix mode → your December sheet");
  await bot.start({
    onStart: (info) => console.log(`Bot @${info.username} is running`),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
