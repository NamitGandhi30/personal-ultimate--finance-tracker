"""Telegram Bot webhook.

Setup:
  1. Create a bot via @BotFather, set TELEGRAM_BOT_TOKEN (and TELEGRAM_BOT_USERNAME).
  2. Pick a secret and set TELEGRAM_WEBHOOK_SECRET.
  3. Register the webhook (HTTPS, public):
       curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
         -d url="https://YOUR_HOST/channels/telegram/webhook" \
         -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
"""

import hmac
import logging
import os

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.channels import net
from app.channels.ingestion import handle_inbound
from app.database import session_scope

logger = logging.getLogger("puft.telegram")
router = APIRouter(prefix="/channels/telegram", tags=["channels"])


def _get_session():
    with session_scope() as session:
        yield session


def _api_base() -> str:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    return f"https://api.telegram.org/bot{token}"


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    session: Session = Depends(_get_session),
    secret_token: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
) -> dict:
    expected = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    if expected and not (secret_token and hmac.compare_digest(secret_token, expected)):
        # Always 200 so Telegram doesn't retry a forged/misconfigured call in a loop.
        return {"ok": False}

    update = await request.json()
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if chat_id is None:
        return {"ok": True}

    sender = message.get("from") or {}
    display_name = sender.get("first_name") or sender.get("username")
    text = message.get("text") or message.get("caption") or ""
    image_base64 = _extract_photo(message)

    try:
        reply = handle_inbound(
            session,
            platform="telegram",
            external_id=str(chat_id),
            text=text,
            image_base64=image_base64,
            display_name=display_name,
        )
    except Exception:
        logger.exception("Telegram ingestion failed")
        reply = "Something went wrong logging that. Please try again."

    _send_message(chat_id, reply)
    return {"ok": True}


def _extract_photo(message: dict) -> str | None:
    photos = message.get("photo")
    if not photos:
        # Image sent as an uncompressed document also carries a file_id.
        document = message.get("document") or {}
        if str(document.get("mime_type", "")).startswith("image/"):
            return _download_file(document.get("file_id"))
        return None
    # Telegram sends multiple sizes ascending; the last is the largest.
    return _download_file(photos[-1].get("file_id"))


def _download_file(file_id: str | None) -> str | None:
    if not file_id:
        return None
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return None
    try:
        info = net.get_json(f"{_api_base()}/getFile?file_id={file_id}")
        file_path = (info.get("result") or {}).get("file_path")
        if not file_path:
            return None
        return net.get_data_url(f"https://api.telegram.org/file/bot{token}/{file_path}")
    except Exception:
        logger.exception("Telegram file download failed")
        return None


def _send_message(chat_id: int, text: str) -> None:
    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        logger.warning("TELEGRAM_BOT_TOKEN not set; skipping reply")
        return
    try:
        net.post_json(
            f"{_api_base()}/sendMessage",
            {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
        )
    except Exception:
        logger.exception("Telegram sendMessage failed")
