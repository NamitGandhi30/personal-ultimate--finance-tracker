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

Endpoints:

- `GET /health`
- `GET /health/db`
- `POST /categorize` — suggest a category for a description/merchant
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
