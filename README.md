# Expense Telegram Bot

Голос или текст в Telegram → Gemini (STT + парсинг расхода) → строка в **Google Sheets**.

Портфолио-проект: AI-пайплайн + интеграция с внешними API + деплой бота.

## Стек

- **TypeScript** + **Grammy** (Telegram Bot API, long polling)
- **Google Gemini** — транскрипция голоса и извлечение `{date, amount, currency, category, note}`
- **Google Sheets API** — запись через service account

## Как это работает

```
Telegram message (text | voice)
        │
        ▼
  [voice] Gemini STT → transcript
        │
        ▼
  Gemini → structured Expense JSON
        │
        ▼
  Google Sheets append row
        │
        ▼
  Reply confirmation in chat
```

## Google Sheets (заготовка таблицы)

1. Создай таблицу (или используй шаблон за декабрь).
2. Переименуй лист в `Expenses` (или задай `GOOGLE_SHEET_TAB` в `.env`).
3. Заголовки (бот допишет сам, если лист пустой):

| date | amount | currency | category | note | source |
|------|--------|----------|----------|------|--------|

Категории: `food`, `transport`, `home`, `health`, `fun`, `shopping`, `bills`, `other`.

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

- `кофе 250`
- `такси 450 вчера`
- `продукты 3200 руб`
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
