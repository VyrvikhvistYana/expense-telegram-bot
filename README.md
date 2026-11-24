# Expense Telegram Bot

Голос или текст в Telegram → Gemini (STT + парсинг) → **ячейка в Google Sheets** (дата × категория).

Портфолио-проект: AI-пайплайн + интеграция с внешними API + деплой бота.

## Стек

- **TypeScript** + **Grammy** (Telegram Bot API, long polling)
- **Google Gemini** — транскрипция голоса и извлечение `{date, amount, category, note}`
- **Google Sheets API** — запись в матрицу через service account

## Как это работает

```
Telegram message (text | voice)
        │
        ▼
  [voice] Gemini STT → transcript
        │
        ▼
  Gemini → Expense JSON (дата + категория из колонок таблицы)
        │
        ▼
  Google Sheets: найти строку даты и колонку категории,
  прибавить сумму к ячейке
        │
        ▼
  Reply confirmation in chat
```

## Google Sheets (твоя матрица)

Формат листа:

| Дата | Доходы | на начало месяца | Олежда детей | Еда | … |
|------|--------|------------------|--------------|-----|---|
| 01.12.2026 | | | | | |
| … | | | | | |

Бот пишет только в колонки расходов (не в «Доходы» / «на начало месяца»).  
Если в ячейке уже было число — **прибавляет** новую сумму.

`GOOGLE_SHEET_TAB` можно оставить пустым (берётся первый лист).

## Настройка за 15 минут

### 1. Telegram

1. [@BotFather](https://t.me/BotFather) → `/newbot` → скопируй token.
2. Свой user id: [@userinfobot](https://t.me/userinfobot) → положи в `ALLOWED_USER_IDS` (иначе бот открыт всем).

### 2. Gemini

Ключ: [Google AI Studio](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`.

### 3. Google Cloud + Sheets

1. [Google Cloud Console](https://console.cloud.google.com/) → новый проект.
2. Enable **Google Sheets API**.
3. **IAM → Service Accounts** → Create → скачай JSON-ключ.
4. Положи файл в `credentials/service-account.json` (папка в `.gitignore`).
5. Открой таблицу → **Share** → email service account (`...@....iam.gserviceaccount.com`) → Editor.
6. `GOOGLE_SHEETS_ID` — id из URL:  
   `https://docs.google.com/spreadsheets/d/<THIS_ID>/edit`

### 4. Локальный запуск

```bash
cd expense-telegram-bot
cp .env.example .env
# заполни .env, положи credentials/service-account.json

npm install
npm run dev
```

В Telegram: `/start` → `кофе 250` или голосовое.

## Деплой (Render)

**Free web service** засыпает ~через 15 мин без трафика — для webhook/polling бота неудобно (нужен «будильник» или платный always-on).

Практичные варианты для портфолио:

| Вариант | Плюсы | Минусы |
|---------|--------|--------|
| Render **Starter** (~$7/мес) | 24/7, просто | платно |
| Railway / Fly.io | похоже | лимиты free |
| VPS / домашний сервер | контроль | сам следишь |

На Render:

1. New **Background Worker** (или Web Service с `npm start`).
2. Env vars из `.env` + секрет JSON (как env `GOOGLE_SERVICE_ACCOUNT_JSON` — при желании можно доработать чтение из env).
3. Start command: `npm start`.

Сейчас бот на **long polling** — для одного инстанса этого достаточно. Webhook можно добавить позже.

## Примеры сообщений

- `кофе 250` → колонка «Еда», сегодняшняя дата (если есть в таблице)
- `5 декабря подарки 1500`
- `кружок ребёнку 2000` → «Кружки/медицина_детей»
- голосовое: «потратила тысячу на продукты»

## Структура

```
src/
  index.ts         # Telegram handlers
  config.ts        # env
  parseExpense.ts  # Gemini → Expense
  voice.ts         # Gemini STT
  sheets.ts        # Google Sheets append
```

## Что показать в портфолио

- Скрин чата: голос → подтверждение с суммой/категорией
- Скрин строки в Sheets
- Короткий README + этот пайплайн
- (Опционально) демо-видео 30–60 сек
