"""Platform-agnostic inbound message handling.

Every chat integration (Telegram, WhatsApp, Notion) funnels messages through
`handle_inbound`, which links accounts, runs commands, and turns free text or
receipt images into transactions using the same categorization + receipt-scan
logic the apps use.
"""

import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.intelligence import scan_receipt
from app.models import TransactionModel, UserModel
from app.repositories import ChannelLinkRepository, TransactionRepository
from app.schemas import TransactionCreate

INCOME_WORDS = ["earned", "salary", "income", "received", "credited", "refund", "got paid", "paid me"]
_LINK_RE = re.compile(r"^\s*/?link\s+([A-Za-z0-9]{4,12})\s*$", re.IGNORECASE)
_AMOUNT_RE = re.compile(r"(\d+(?:[.,]\d{1,2})?)")

HELP_TEXT = (
    "💸 *PUFT bot*\n"
    "Send me an expense and I'll log it:\n"
    "• `250 lunch at swiggy`\n"
    "• `1500 petrol`\n"
    "• `income 50000 salary`\n"
    "Or just send a photo of a receipt.\n\n"
    "Commands:\n"
    "• `balance` — this month's summary\n"
    "• `undo` — remove your last entry\n"
    "• `link <code>` — connect this chat (get a code in the PUFT app)\n"
    "• `help` — show this message"
)


def handle_inbound(
    session: Session,
    platform: str,
    external_id: str,
    text: str | None = None,
    image_base64: str | None = None,
    display_name: str | None = None,
) -> str:
    """Process one inbound message and return the reply text to send back."""
    text = (text or "").strip()
    links = ChannelLinkRepository(session)

    # 1. Account linking happens before auth — it's how a user authenticates.
    match = _LINK_RE.match(text)
    if match:
        user = links.claim_code(match.group(1), platform, external_id, display_name)
        if user is None:
            return "That code is invalid or expired. Open the PUFT app → Connect chat to get a fresh one."
        return f"✅ Linked to *{user.full_name or user.username}*. Send an expense or a receipt photo to get started!"

    # 2. Everything else requires a linked account.
    user = links.resolve_user(platform, external_id)
    if user is None:
        return (
            "This chat isn't linked yet. Open the PUFT app → *Connect chat*, then send me "
            "`link <code>` with the code it shows."
        )

    lowered = text.lower()
    if not text and not image_base64:
        return HELP_TEXT
    if lowered in {"help", "/help", "/start", "start"}:
        return HELP_TEXT
    if lowered in {"balance", "/balance", "summary", "/summary"}:
        return _balance_reply(session, user)
    if lowered in {"undo", "/undo", "delete last"}:
        return _undo_reply(session, user)

    if image_base64:
        return _handle_receipt(session, user, image_base64, caption=text)
    return _handle_text_expense(session, user, text)


def _handle_text_expense(session: Session, user: UserModel, text: str) -> str:
    payload = parse_expense_text(text)
    if payload is None:
        return "I couldn't find an amount in that. Try something like `250 lunch` or send `help`."

    transaction = TransactionRepository(session, user.username).create(payload)
    session.commit()
    return _logged_reply(transaction)


def _handle_receipt(session: Session, user: UserModel, image_base64: str, caption: str = "") -> str:
    result = scan_receipt(image_base64=image_base64, filename="chat-receipt")
    draft = result["transaction"]
    amount = float(draft.get("amount") or 0)
    if amount <= 0:
        warnings = "; ".join(result.get("warnings", [])[:2])
        hint = f" ({warnings})" if warnings else ""
        return (
            "I scanned the receipt but couldn't read a total" + hint + ".\n"
            "You can type it instead, e.g. `450 groceries at dmart`."
        )

    payload = TransactionCreate(
        amount=round(amount, 2),
        description=(caption.strip() or draft.get("description") or "Receipt expense")[:240],
        category=draft.get("category") or "",
        merchant=(draft.get("merchant") or "Receipt")[:120],
        is_income=False,
    )
    transaction = TransactionRepository(session, user.username).create(payload)
    session.commit()

    note = "" if not result.get("needs_review") else "\n_(low confidence — double-check in the app)_"
    return _logged_reply(transaction, prefix="🧾 Receipt logged") + note


def parse_expense_text(text: str) -> TransactionCreate | None:
    """Parse free text like '250 lunch at swiggy' into a transaction draft.

    Category is left empty so the server categorizer fills it in.
    """
    match = _AMOUNT_RE.search(text)
    if match is None:
        return None
    amount = float(match.group(1).replace(",", "."))
    if amount <= 0:
        return None

    remainder = (text[: match.start()] + " " + text[match.end():]).strip()
    lowered = text.lower()
    is_income = any(word in lowered for word in INCOME_WORDS)

    # Strip leading verbs so the description reads naturally.
    remainder = re.sub(
        r"^(spent|paid|for|on|got|earned|income|received|credited|expense)\s+",
        "",
        remainder,
        flags=re.IGNORECASE,
    ).strip()
    description = _title_case(remainder) or ("Income" if is_income else "Quick entry")
    merchant = _detect_merchant(lowered, description, is_income)

    return TransactionCreate(
        amount=round(amount, 2),
        description=description[:240],
        category="Income" if is_income else "",
        merchant=merchant[:120],
        is_income=is_income,
    )


def _detect_merchant(lowered: str, description: str, is_income: bool) -> str:
    if is_income:
        return "Income"
    known = [
        "swiggy", "zomato", "dmart", "bigbasket", "blinkit", "zepto", "instamart",
        "uber", "ola", "rapido", "amazon", "flipkart", "netflix", "spotify", "irctc",
    ]
    hit = next((m for m in known if m in lowered), None)
    if hit:
        return hit.title()
    # Word after "at"/"from" is usually the merchant.
    at_match = re.search(r"\b(?:at|from)\s+([A-Za-z][\w&'. ]{1,40})", lowered)
    if at_match:
        return _title_case(at_match.group(1).strip())
    first = description.split()
    return first[0] if first else "Manual"


def _balance_reply(session: Session, user: UserModel) -> str:
    transactions = TransactionRepository(session, user.username).list()
    now = datetime.now(timezone.utc)
    spend = income = 0.0
    for tx in transactions:
        tx_date = tx.date
        if tx_date.tzinfo is None:
            tx_date = tx_date.replace(tzinfo=timezone.utc)
        if tx_date.year != now.year or tx_date.month != now.month:
            continue
        if tx.is_income:
            income += tx.amount
        else:
            spend += tx.amount
    net = income - spend
    return (
        f"📊 *{now.strftime('%B %Y')}*\n"
        f"Income: {_money(income)}\n"
        f"Spent: {_money(spend)}\n"
        f"Net: {_money(net)}"
    )


def _undo_reply(session: Session, user: UserModel) -> str:
    repo = TransactionRepository(session, user.username)
    latest = (
        session.query(TransactionModel)
        .filter(TransactionModel.user_id == user.id)
        .order_by(TransactionModel.id.desc())
        .first()
    )
    if latest is None:
        return "Nothing to undo — you have no manual entries yet."
    summary = f"{_money(latest.amount)} · {latest.description}"
    repo.delete(latest.id)
    session.commit()
    return f"🗑️ Removed: {summary}"


def _logged_reply(transaction: TransactionModel, prefix: str = "✅ Logged") -> str:
    sign = "+" if transaction.is_income else "-"
    return (
        f"{prefix} {sign}{_money(transaction.amount)}\n"
        f"{transaction.description} · _{transaction.category}_\n"
        f"Send `balance` for your monthly summary."
    )


def _title_case(value: str) -> str:
    return " ".join(word[:1].upper() + word[1:] for word in value.split() if word)


def _money(value: float) -> str:
    return f"Rs {round(value):,}"
