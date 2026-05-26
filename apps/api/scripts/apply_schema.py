from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
API_DIR = ROOT / "apps" / "api"
sys.path.insert(0, str(API_DIR))

from app.database import DATABASE_URL, engine  # noqa: E402

MIGRATIONS_DIR = ROOT / "supabase" / "migrations"


def main() -> None:
    if not DATABASE_URL.startswith("postgresql"):
        raise SystemExit("Set DATABASE_URL to a Supabase/Postgres URL before applying Supabase migrations.")

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        raise SystemExit("No migration files found.")

    with engine.begin() as connection:
        for migration_file in migration_files:
            sql = migration_file.read_text(encoding="utf-8")
            connection.exec_driver_sql(sql)
            print(f"Applied {migration_file.name}")


if __name__ == "__main__":
    main()
