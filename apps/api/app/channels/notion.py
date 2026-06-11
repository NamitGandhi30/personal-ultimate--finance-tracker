"""Notion integration (poll-based).

Notion has no reliable per-row push, so PUFT polls a shared database and logs
any unprocessed rows. Each row carries the user's link code so we know whose
account to write to.

Setup:
  1. Create an internal Notion integration; set NOTION_TOKEN.
  2. Create a database with these properties (names overridable via env):
       Description (title), Amount (number), Merchant (text), Type (select:
       Expense/Income), Code (text), Status (select: New/Logged).
     Share the database with the integration; set NOTION_DATABASE_ID.
  3. Trigger sync on a schedule (cron) by POSTing to
     /channels/notion/sync with header  X-Sync-Secret: <NOTION_SYNC_SECRET>.

The first row a user adds must include the code from the PUFT app within 15
minutes of generating it; after that the link persists and any row with the
same code is attributed to them.
"""

import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.channels import net
from app.channels.ingestion import parse_expense_text
from app.database import session_scope
from app.repositories import ChannelLinkRepository, TransactionRepository
from app.schemas import TransactionCreate

logger = logging.getLogger("puft.notion")
router = APIRouter(prefix="/channels/notion", tags=["channels"])

NOTION_VERSION = "2022-06-28"


def _get_session():
    with session_scope() as session:
        yield session


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {os.getenv('NOTION_TOKEN', '')}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def _prop(name_env: str, default: str) -> str:
    return os.getenv(name_env, default)


@router.post("/sync")
def notion_sync(
    session: Session = Depends(_get_session),
    sync_secret: str | None = Header(default=None, alias="X-Sync-Secret"),
) -> dict:
    expected = os.getenv("NOTION_SYNC_SECRET", "")
    if expected and sync_secret != expected:
        raise HTTPException(status_code=403, detail="Invalid sync secret")
    if not os.getenv("NOTION_TOKEN") or not os.getenv("NOTION_DATABASE_ID"):
        raise HTTPException(status_code=400, detail="NOTION_TOKEN and NOTION_DATABASE_ID must be set")
    return sync_notion(session)


def sync_notion(session: Session) -> dict:
    database_id = os.getenv("NOTION_DATABASE_ID", "")
    status_prop = _prop("NOTION_STATUS_PROPERTY", "Status")
    logged_value = os.getenv("NOTION_LOGGED_VALUE", "Logged")

    query = {
        "filter": {
            "property": status_prop,
            "select": {"does_not_equal": logged_value},
        },
        "page_size": 50,
    }
    try:
        result = net.post_json(
            f"https://api.notion.com/v1/databases/{database_id}/query",
            query,
            headers=_headers(),
        )
    except Exception:
        logger.exception("Notion query failed")
        raise HTTPException(status_code=502, detail="Could not reach Notion")

    logged = 0
    skipped = 0
    links = ChannelLinkRepository(session)

    for page in result.get("results", []):
        props = page.get("properties", {})
        code = _read_text(props.get(_prop("NOTION_CODE_PROPERTY", "Code")))
        amount = _read_number(props.get(_prop("NOTION_AMOUNT_PROPERTY", "Amount")))
        description = _read_text(props.get(_prop("NOTION_DESCRIPTION_PROPERTY", "Description")))
        merchant = _read_text(props.get(_prop("NOTION_MERCHANT_PROPERTY", "Merchant")))
        type_value = _read_select(props.get(_prop("NOTION_TYPE_PROPERTY", "Type")))

        if not code or amount is None or amount <= 0:
            skipped += 1
            continue

        user = links.resolve_user("notion", code) or links.claim_code(code, "notion", code, None)
        if user is None:
            skipped += 1
            continue

        is_income = (type_value or "").lower() == "income"
        if not description:
            description = "Income" if is_income else "Notion expense"
        payload = TransactionCreate(
            amount=round(amount, 2),
            description=description[:240],
            category="Income" if is_income else "",
            merchant=(merchant or ("Income" if is_income else description))[:120],
            is_income=is_income,
        )
        TransactionRepository(session, user.username).create(payload)
        session.commit()
        _mark_logged(page.get("id"), status_prop, logged_value)
        logged += 1

    return {"logged": logged, "skipped": skipped}


def _mark_logged(page_id: str | None, status_prop: str, logged_value: str) -> None:
    if not page_id:
        return
    try:
        net.patch_json(
            f"https://api.notion.com/v1/pages/{page_id}",
            {"properties": {status_prop: {"select": {"name": logged_value}}}},
            headers=_headers(),
        )
    except Exception:
        logger.exception("Notion page update failed for %s", page_id)


def _read_text(prop: dict | None) -> str:
    if not prop:
        return ""
    for key in ("title", "rich_text"):
        spans = prop.get(key)
        if spans:
            return "".join(span.get("plain_text", "") for span in spans).strip()
    return ""


def _read_number(prop: dict | None) -> float | None:
    if not prop:
        return None
    value = prop.get("number")
    return float(value) if isinstance(value, (int, float)) else None


def _read_select(prop: dict | None) -> str | None:
    if not prop:
        return None
    selected = prop.get("select")
    return selected.get("name") if selected else None
