# PUFT Getting Started Plan

## First Milestone

Ship the smallest useful habit loop:

1. Open the web app.
2. Type a quick expense such as `250 lunch`.
3. Save it through the FastAPI backend in under 5 seconds.
4. See the transaction list and dashboard totals update instantly.

## Architecture Direction

- Next.js + React for the primary web app.
- FastAPI for the backend API.
- Flutter remains the mobile app path after web/API flows are proven.
- Keep product logic simple before adding persistence and sync complexity.
- Start with local-first storage, then add cloud sync.
- Avoid full CRDT sync until multi-device conflict cases are real.

## Build Order

1. Next.js web quick entry parser and transaction model.
2. FastAPI transaction API.
3. Dashboard shell with month spend, income, today spend, and category pulse.
4. Transaction list with edit/delete.
5. Database persistence with PostgreSQL.
6. CSV import/export.
7. Groups with equal split and settlement status.
8. Subscription detection from recurring merchant patterns.
9. Receipt upload with a mocked parser, then real OCR/AI parsing.

## Near-Term Technical Choices

- Web state: React state first, TanStack Query when API workflows expand.
- API: FastAPI with Pydantic schemas and pytest tests.
- Storage: PostgreSQL through SQLAlchemy or SQLModel.
- Charts: Recharts after the dashboard data model stabilizes.
- Auth/sync: add only after local workflows feel fast.

## Next Action

Replace in-memory API transactions with a repository interface and PostgreSQL persistence.
