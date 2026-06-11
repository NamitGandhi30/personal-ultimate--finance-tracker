"""Authenticated endpoints for connecting chat platforms to a PUFT account."""

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_auth
from app.database import session_scope
from app.repositories import LINK_CODE_TTL, ChannelLinkRepository, UserRepository
from app.schemas import ChannelLinkRead, ChannelLinkStartResponse

router = APIRouter(prefix="/channels", tags=["channels"])


def _get_session():
    with session_scope() as session:
        yield session


def _telegram_bot_username() -> str:
    return os.getenv("TELEGRAM_BOT_USERNAME", "your_bot")


@router.post("/link/start", response_model=ChannelLinkStartResponse)
def start_link(
    session: Session = Depends(_get_session),
    username: str = Depends(require_auth),
) -> ChannelLinkStartResponse:
    user = UserRepository(session).get_by_username(username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    code = ChannelLinkRepository(session).start_link(user)
    session.commit()
    bot = _telegram_bot_username()
    return ChannelLinkStartResponse(
        code=code,
        expires_in_seconds=int(LINK_CODE_TTL.total_seconds()),
        instructions={
            "telegram": f"Open https://t.me/{bot} and send: link {code}",
            "whatsapp": f"Message the PUFT WhatsApp number: link {code}",
            "notion": f"Add 'link {code}' to your linked Notion database, or paste the code in PUFT.",
        },
    )


@router.get("/links", response_model=list[ChannelLinkRead])
def list_links(
    session: Session = Depends(_get_session),
    username: str = Depends(require_auth),
) -> list[ChannelLinkRead]:
    user = UserRepository(session).get_by_username(username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return ChannelLinkRepository(session).list_for_user(user)


@router.delete("/links/{platform}", status_code=204)
def unlink(
    platform: str,
    session: Session = Depends(_get_session),
    username: str = Depends(require_auth),
) -> None:
    user = UserRepository(session).get_by_username(username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not ChannelLinkRepository(session).unlink(user, platform):
        raise HTTPException(status_code=404, detail="No link for this platform")
    session.commit()
