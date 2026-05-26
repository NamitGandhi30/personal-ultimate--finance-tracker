# PUFT FastAPI

Run locally:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

Endpoints:

- `GET /health`
- `GET /transactions`
- `POST /transactions`
