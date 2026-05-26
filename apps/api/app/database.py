import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


API_DIR = Path(__file__).resolve().parents[1]
load_dotenv(API_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./puft.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_transaction_trip_link()


def ensure_transaction_trip_link() -> None:
    inspector = inspect(engine)
    if "transactions" not in inspector.get_table_names():
        return

    transaction_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "trip_id" in transaction_columns:
        return

    if DATABASE_URL.startswith("sqlite"):
        add_column_sql = "ALTER TABLE transactions ADD COLUMN trip_id INTEGER"
    else:
        add_column_sql = "ALTER TABLE public.transactions ADD COLUMN trip_id bigint REFERENCES public.trips(id) ON DELETE SET NULL"

    with engine.begin() as connection:
        connection.execute(text(add_column_sql))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON transactions (trip_id)"))


def check_db() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def database_kind() -> str:
    if DATABASE_URL.startswith("sqlite"):
        return "sqlite"
    if "supabase" in DATABASE_URL or "pooler.supabase.com" in DATABASE_URL:
        return "supabase"
    if DATABASE_URL.startswith("postgresql"):
        return "postgresql"
    return "unknown"


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
