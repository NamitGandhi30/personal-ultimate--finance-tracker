"""Test environment must be set before any test module imports app code,
because app.database binds its engine at import time."""
import os
from pathlib import Path

test_db = Path("test_puft.db")
if test_db.exists():
    test_db.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{test_db}"
os.environ["AUTH_USERNAME"] = "admin"
os.environ["AUTH_PASSWORD"] = "admin"
os.environ["AUTH_SECRET"] = "test-secret-that-is-long-enough-for-suite"
os.environ["AI_PROVIDER"] = "off"
