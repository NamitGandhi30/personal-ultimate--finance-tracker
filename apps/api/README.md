# PUFT FastAPI

Run locally:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

The API reads `DATABASE_URL` from `apps/api/.env`. SQLite is the fallback and
writes `puft.db` in the API working directory.

## Supabase

Recommended connection mode: Supabase transaction pooler. It drops directly
into this backend and is friendlier for server processes that may restart often.

1. Copy the env template:

```powershell
Copy-Item .env.example .env
```

2. Paste your provider's Postgres URL into `.env` as `DATABASE_URL`.

Neon format:

```txt
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Supabase pooled format for this project:

```txt
DATABASE_URL=postgresql+psycopg://postgres.hysnseeryflzlqzwmhzr:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require
```

3. Restart the API and check:

```powershell
.venv\Scripts\python -m uvicorn app.main:app --reload
Invoke-WebRequest http://127.0.0.1:8000/health/db
```

4. Apply the schema to the configured database:

```powershell
.venv\Scripts\python apps/api/scripts/apply_schema.py
```

## AI categorization

Transactions created with an empty category (or `"General"` / `"auto"`) are
auto-categorized on the server. Resolution order: learned per-user rules (built
from your category corrections) -> curated keyword rules -> AI provider ->
`General`. The same provider config also powers receipt scanning
(`app/ai_providers.py`).

Pick the provider with `AI_PROVIDER` in `apps/api/.env`:

```txt
# one of: ollama | anthropic | gemini | openai | off
# unset = auto-detect from whichever keys below are present,
# tried in order: ollama, anthropic, gemini, openai
AI_PROVIDER=ollama

# Ollama (default; for Ollama Cloud set both):
OLLAMA_BASE_URL=https://ollama.com/api
OLLAMA_API_KEY=...
OLLAMA_MODEL=llava

# Claude:
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-opus-4-8   # or claude-haiku-4-5 for cheaper calls

# Gemini:
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

# OpenAI:
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

## Chat integrations (Telegram / WhatsApp / Notion)

Users connect a chat app once, then log expenses by texting the bot or sending a
receipt photo. All three funnel through one ingestion pipeline
(`app/channels/ingestion.py`) that reuses categorization and receipt scanning.

**Linking:** in the app, call `POST /channels/link/start` (authenticated) to get
a 6-character code, then send `link <code>` from the chat platform. Codes expire
in 15 minutes. `GET /channels/links` lists connected platforms;
`DELETE /channels/links/{platform}` disconnects one.

Once linked, a user can send:

- `250 lunch at swiggy` → logs an expense (server auto-categorizes)
- `income 50000 salary` → logs income
- a receipt photo → OCR/AI scan → logged
- `balance` → this month's summary · `undo` → remove last entry · `help`

### Telegram

```txt
TELEGRAM_BOT_TOKEN=...           # from @BotFather
TELEGRAM_BOT_USERNAME=your_bot   # used in linking instructions
TELEGRAM_WEBHOOK_SECRET=...      # any random string
```

Register the webhook (public HTTPS host required):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url="https://YOUR_HOST/channels/telegram/webhook" \
  -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
```

### WhatsApp (Meta Cloud API)

```txt
WHATSAPP_TOKEN=...               # permanent access token
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...        # any string, matches dashboard
WHATSAPP_APP_SECRET=...          # for X-Hub-Signature-256 verification
WHATSAPP_GRAPH_VERSION=v21.0     # optional
```

Set the callback URL to `https://YOUR_HOST/channels/whatsapp/webhook` with the
same verify token and subscribe to the `messages` field.

### Notion (poll-based)

Notion has no reliable per-row push, so PUFT polls a shared database.

```txt
NOTION_TOKEN=...                 # internal integration token
NOTION_DATABASE_ID=...
NOTION_SYNC_SECRET=...           # protects the sync trigger
# Optional property-name overrides (defaults shown):
# NOTION_DESCRIPTION_PROPERTY=Description  NOTION_AMOUNT_PROPERTY=Amount
# NOTION_MERCHANT_PROPERTY=Merchant  NOTION_TYPE_PROPERTY=Type
# NOTION_CODE_PROPERTY=Code  NOTION_STATUS_PROPERTY=Status  NOTION_LOGGED_VALUE=Logged
```

Database properties: `Description` (title), `Amount` (number), `Merchant`
(text), `Type` (select: Expense/Income), `Code` (text), `Status` (select:
New/Logged). Trigger sync from cron:

```bash
curl -X POST https://YOUR_HOST/channels/notion/sync -H "X-Sync-Secret: <NOTION_SYNC_SECRET>"
```

Endpoints:

- `GET /health`
- `GET /health/db`
- `POST /categorize` — suggest a category for a description/merchant
- `POST /receipts/scan` — OCR/AI receipt parsing
- `GET /insights/forecast` · `GET /insights/history`
- `POST /channels/link/start` · `GET /channels/links` · `DELETE /channels/links/{platform}`
- `POST /channels/telegram/webhook` · `GET|POST /channels/whatsapp/webhook` · `POST /channels/notion/sync`
- `GET /transactions`
- `POST /transactions`
- `GET /trips`
- `POST /trips`

## Schema

The Supabase migration is in:

```txt
supabase/migrations/202605260001_create_transactions.sql
```

The migrations create `public.transactions` and `public.trips`, add indexes used
by the API, enable RLS, and revoke Data API table access from `anon` and
`authenticated`. The FastAPI backend connects server-side through Postgres, so
browser clients do not need direct table access.
