from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_transaction() -> None:
    response = client.post(
        "/transactions",
        json={
            "amount": 1200,
            "description": "Groceries at DMart",
            "category": "Groceries",
            "merchant": "Dmart",
            "is_income": False,
        },
    )

    assert response.status_code == 201
    assert response.json()["amount"] == 1200
    assert response.json()["category"] == "Groceries"
