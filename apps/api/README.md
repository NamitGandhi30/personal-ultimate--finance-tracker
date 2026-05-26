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

Endpoints:

- `GET /health`
- `GET /health/db`
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
