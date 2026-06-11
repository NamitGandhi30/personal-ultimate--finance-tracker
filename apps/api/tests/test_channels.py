"""Chat integration tests. Outbound network calls are avoided by leaving the
platform tokens unset (send/download helpers short-circuit) and by monkeypatching
Notion's HTTP layer."""

from fastapi.testclient import TestClient

from app.channels import notion
from app.main import app


def _register(client: TestClient, username: str) -> dict[str, str]:
    client.post(
        "/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "full_name": f"{username.title()} User",
            "password": "strong-password-1",
        },
    )
    token = client.post(
        "/auth/login", json={"username": username, "password": "strong-password-1"}
    ).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _start_code(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post("/channels/link/start", headers=headers)
    assert response.status_code == 200
    return response.json()["code"]


def _telegram(client: TestClient, chat_id: int, text: str = "", **message) -> None:
    payload = {"message": {"chat": {"id": chat_id}, "from": {"first_name": "Tester"}, **message}}
    if text:
        payload["message"]["text"] = text
    assert client.post("/channels/telegram/webhook", json=payload).status_code == 200


def test_link_start_requires_auth() -> None:
    with TestClient(app) as client:
        assert client.post("/channels/link/start").status_code == 401


def test_telegram_link_and_log_expense() -> None:
    with TestClient(app) as client:
        headers = _register(client, "tguser")
        code = _start_code(client, headers)

        # Unlinked chat is told to link.
        _telegram(client, 1001, "250 lunch")
        assert client.get("/transactions", headers=headers).json() == []

        # Claim the code, then log an expense and an income.
        _telegram(client, 1001, f"link {code}")
        _telegram(client, 1001, "250 lunch at swiggy")
        _telegram(client, 1001, "income 50000 salary")

        transactions = client.get("/transactions", headers=headers).json()
        descriptions = {t["description"] for t in transactions}
        assert "Lunch At Swiggy" in descriptions
        food = next(t for t in transactions if t["description"] == "Lunch At Swiggy")
        assert food["category"] == "Food"  # server categorized it
        assert food["merchant"] == "Swiggy"
        assert any(t["is_income"] and t["amount"] == 50000 for t in transactions)


def test_telegram_balance_and_undo() -> None:
    with TestClient(app) as client:
        headers = _register(client, "tguser2")
        code = _start_code(client, headers)
        _telegram(client, 2002, f"link {code}")
        _telegram(client, 2002, "300 groceries at dmart")
        before = client.get("/transactions", headers=headers).json()
        assert len(before) == 1

        _telegram(client, 2002, "undo")
        after = client.get("/transactions", headers=headers).json()
        assert after == []


def test_telegram_link_codes_are_per_user() -> None:
    with TestClient(app) as client:
        headers_a = _register(client, "alice")
        headers_b = _register(client, "bob")
        code_a = _start_code(client, headers_a)
        _start_code(client, headers_b)

        _telegram(client, 3003, f"link {code_a}")
        _telegram(client, 3003, "100 coffee")

        assert len(client.get("/transactions", headers=headers_a).json()) == 1
        assert client.get("/transactions", headers=headers_b).json() == []


def test_whatsapp_link_and_log() -> None:
    with TestClient(app) as client:
        headers = _register(client, "wauser")
        code = _start_code(client, headers)

        def send(text: str) -> None:
            payload = {
                "entry": [
                    {
                        "changes": [
                            {
                                "value": {
                                    "contacts": [{"profile": {"name": "WA Tester"}, "wa_id": "919900112233"}],
                                    "messages": [
                                        {"from": "919900112233", "type": "text", "text": {"body": text}}
                                    ],
                                }
                            }
                        ]
                    }
                ]
            }
            assert client.post("/channels/whatsapp/webhook", json=payload).status_code == 200

        send(f"link {code}")
        send("1500 petrol")
        transactions = client.get("/transactions", headers=headers).json()
        assert any(t["category"] == "Transport" and t["amount"] == 1500 for t in transactions)


def test_whatsapp_verify_challenge(monkeypatch) -> None:
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "verify-me")
    with TestClient(app) as client:
        response = client.get(
            "/channels/whatsapp/webhook",
            params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "echo123"},
        )
        assert response.status_code == 200
        assert response.text == "echo123"

        bad = client.get(
            "/channels/whatsapp/webhook",
            params={"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "echo123"},
        )
        assert bad.status_code == 403


def test_notion_sync_logs_rows(monkeypatch) -> None:
    with TestClient(app) as client:
        headers = _register(client, "notionuser")
        code = _start_code(client, headers)

        monkeypatch.setenv("NOTION_TOKEN", "secret")
        monkeypatch.setenv("NOTION_DATABASE_ID", "db123")

        rows = {
            "results": [
                {
                    "id": "page-1",
                    "properties": {
                        "Code": {"rich_text": [{"plain_text": code}]},
                        "Amount": {"number": 800},
                        "Description": {"title": [{"plain_text": "Dinner at zomato"}]},
                        "Type": {"select": {"name": "Expense"}},
                    },
                }
            ]
        }
        patched_pages: list[str] = []
        monkeypatch.setattr(notion.net, "post_json", lambda *a, **k: rows)
        monkeypatch.setattr(notion.net, "patch_json", lambda url, *a, **k: patched_pages.append(url) or {})

        response = client.post("/channels/notion/sync")
        assert response.status_code == 200
        assert response.json()["logged"] == 1
        assert any("page-1" in url for url in patched_pages)

        transactions = client.get("/transactions", headers=headers).json()
        assert any(t["amount"] == 800 and t["category"] == "Food" for t in transactions)
