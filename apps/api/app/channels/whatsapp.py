"""WhatsApp Cloud API webhook (Meta / graph.facebook.com).

Setup:
  1. Create a Meta app with WhatsApp; note the phone number ID and a permanent
     access token. Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID.
  2. Set WHATSAPP_VERIFY_TOKEN (any string) and WHATSAPP_APP_SECRET (app secret).
  3. In the Meta dashboard, set the webhook callback URL to
     https://YOUR_HOST/channels/whatsapp/webhook with the same verify token,
     and subscribe to the "messages" field.
"""

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from app.channels import net
from app.channels.ingestion import handle_inbound
from app.database import session_scope

logger = logging.getLogger("puft.whatsapp")
router = APIRouter(prefix="/channels/whatsapp", tags=["channels"])


def _get_session():
    with session_scope() as session:
        yield session


def _graph_base() -> str:
    version = os.getenv("WHATSAPP_GRAPH_VERSION", "v21.0")
    return f"https://graph.facebook.com/{version}"


@router.get("/webhook")
def verify_webhook(request: Request) -> Response:
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")
    if mode == "subscribe" and token and token == os.getenv("WHATSAPP_VERIFY_TOKEN"):
        return Response(content=challenge, media_type="text/plain")
    return Response(status_code=403)


@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    session: Session = Depends(_get_session),
    signature: str | None = Header(default=None, alias="X-Hub-Signature-256"),
) -> dict:
    raw = await request.body()
    if not _valid_signature(raw, signature):
        return {"ok": False}

    payload = await request.json()
    for message, contact in _iter_messages(payload):
        wa_id = message.get("from")
        if not wa_id:
            continue
        display_name = ((contact or {}).get("profile") or {}).get("name")
        text, image_base64 = _extract_content(message)
        try:
            reply = handle_inbound(
                session,
                platform="whatsapp",
                external_id=str(wa_id),
                text=text,
                image_base64=image_base64,
                display_name=display_name,
            )
        except Exception:
            logger.exception("WhatsApp ingestion failed")
            reply = "Something went wrong logging that. Please try again."
        _send_message(wa_id, reply)

    return {"ok": True}


def _valid_signature(raw: bytes, signature: str | None) -> bool:
    secret = os.getenv("WHATSAPP_APP_SECRET", "")
    if not secret:
        # No secret configured -> accept (dev mode); warn so it's not silent.
        logger.warning("WHATSAPP_APP_SECRET not set; skipping signature check")
        return True
    if not signature or not signature.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature.removeprefix("sha256="), expected)


def _iter_messages(payload: dict):
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value") or {}
            contacts = value.get("contacts") or []
            contact = contacts[0] if contacts else None
            for message in value.get("messages", []):
                yield message, contact


def _extract_content(message: dict) -> tuple[str, str | None]:
    msg_type = message.get("type")
    if msg_type == "text":
        return (message.get("text") or {}).get("body", ""), None
    if msg_type in {"image", "document"}:
        media = message.get(msg_type) or {}
        caption = media.get("caption", "")
        return caption, _download_media(media.get("id"))
    if msg_type == "interactive":
        # Buttons/lists fall back to their title text.
        interactive = message.get("interactive") or {}
        reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
        return reply.get("title", ""), None
    return "", None


def _download_media(media_id: str | None) -> str | None:
    token = os.getenv("WHATSAPP_TOKEN", "")
    if not media_id or not token:
        return None
    try:
        auth = {"Authorization": f"Bearer {token}"}
        meta = net.get_json(f"{_graph_base()}/{media_id}", headers=auth)
        url = meta.get("url")
        if not url:
            return None
        return net.get_data_url(url, headers=auth)
    except Exception:
        logger.exception("WhatsApp media download failed")
        return None


def _send_message(wa_id: str, text: str) -> None:
    token = os.getenv("WHATSAPP_TOKEN", "")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if not token or not phone_number_id:
        logger.warning("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set; skipping reply")
        return
    try:
        net.post_json(
            f"{_graph_base()}/{phone_number_id}/messages",
            {
                "messaging_product": "whatsapp",
                "to": wa_id,
                "type": "text",
                "text": {"body": text},
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    except Exception:
        logger.exception("WhatsApp send failed")
