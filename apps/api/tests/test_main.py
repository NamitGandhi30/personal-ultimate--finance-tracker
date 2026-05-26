import os
from pathlib import Path

from fastapi.testclient import TestClient

test_db = Path("test_puft.db")
if test_db.exists():
    test_db.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{test_db}"
os.environ["AUTH_USERNAME"] = "admin"
os.environ["AUTH_PASSWORD"] = "admin"
os.environ["AUTH_SECRET"] = "test-secret-that-is-long-enough-for-suite"

from app.main import app


def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "connected",
        "provider": "sqlite",
    }


def test_register_customer_and_sign_in() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/auth/register",
            json={
                "username": "customer1",
                "email": "customer1@example.com",
                "full_name": "Customer One",
                "password": "strong-password-1",
                "monthly_income": 90000,
                "savings_goal": 25000,
                "preferred_currency": "INR",
            },
        )
        login_response = client.post(
            "/auth/login",
            json={"username": "customer1", "password": "strong-password-1"},
        )

    assert response.status_code == 201
    assert response.json()["username"] == "customer1"
    assert login_response.status_code == 200
    assert login_response.json()["username"] == "customer1"


def test_create_transaction() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.post(
            "/transactions",
            headers=headers,
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


def test_create_trip() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.post(
            "/trips",
            headers=headers,
            json={
                "name": "Goa reset",
                "destination": "Goa",
                "budget": 18000,
            },
        )
        list_response = client.get("/trips", headers=headers)

    assert response.status_code == 201
    assert response.json()["name"] == "Goa reset"
    assert response.json()["destination"] == "Goa"
    assert list_response.status_code == 200
    assert any(trip["name"] == "Goa reset" for trip in list_response.json())


def test_create_trip_transaction() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        trip_response = client.post(
            "/trips",
            headers=headers,
            json={
                "name": "Kerala",
                "destination": "Munnar",
                "budget": 22000,
            },
        )
        trip_id = trip_response.json()["id"]

        response = client.post(
            "/transactions",
            headers=headers,
            json={
                "amount": 3200,
                "description": "Hotel advance",
                "category": "Travel",
                "merchant": "Hotel",
                "is_income": False,
                "trip_id": trip_id,
            },
        )

    assert response.status_code == 201
    assert response.json()["trip_id"] == trip_id


def test_customers_only_see_their_own_transactions() -> None:
    with TestClient(app) as client:
        first = client.post(
            "/auth/register",
            json={
                "username": "private1",
                "email": "private1@example.com",
                "full_name": "Private One",
                "password": "strong-password-1",
            },
        )
        second = client.post(
            "/auth/register",
            json={
                "username": "private2",
                "email": "private2@example.com",
                "full_name": "Private Two",
                "password": "strong-password-2",
            },
        )
        first_headers = {"Authorization": f"Bearer {first.json()['token']}"}
        second_headers = {"Authorization": f"Bearer {second.json()['token']}"}

        client.post(
            "/transactions",
            headers=first_headers,
            json={
                "amount": 777,
                "description": "Private spend",
                "category": "General",
                "merchant": "Manual",
                "is_income": False,
            },
        )
        response = client.get("/transactions", headers=second_headers)

    assert response.status_code == 200
    assert all(transaction["description"] != "Private spend" for transaction in response.json())


def test_update_transaction_trip() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        trip_response = client.post(
            "/trips",
            headers=headers,
            json={
                "name": "Family trip",
                "destination": "Sikkim",
                "budget": 300000,
            },
        )
        transaction_response = client.post(
            "/transactions",
            headers=headers,
            json={
                "amount": 1500,
                "description": "Airport cab",
                "category": "Travel",
                "merchant": "Cab",
                "is_income": False,
            },
        )

        response = client.patch(
            f"/transactions/{transaction_response.json()['id']}/trip",
            headers=headers,
            json={"trip_id": trip_response.json()["id"]},
        )

    assert response.status_code == 200
    assert response.json()["trip_id"] == trip_response.json()["id"]


def test_update_transaction() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        create_response = client.post(
            "/transactions",
            headers=headers,
            json={
                "amount": 300,
                "description": "Tea",
                "category": "Food",
                "merchant": "Cafe",
                "is_income": False,
            },
        )

        response = client.put(
            f"/transactions/{create_response.json()['id']}",
            headers=headers,
            json={
                "amount": 450,
                "description": "Coffee",
                "category": "Food",
                "merchant": "Blue Tokai",
                "is_income": False,
                "trip_id": None,
            },
        )

    assert response.status_code == 200
    assert response.json()["amount"] == 450
    assert response.json()["description"] == "Coffee"
    assert response.json()["merchant"] == "Blue Tokai"


def test_delete_transaction() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        create_response = client.post(
            "/transactions",
            headers=headers,
            json={
                "amount": 900,
                "description": "Duplicate",
                "category": "General",
                "merchant": "Manual",
                "is_income": False,
            },
        )
        transaction_id = create_response.json()["id"]

        response = client.delete(f"/transactions/{transaction_id}", headers=headers)
        list_response = client.get("/transactions", headers=headers)

    assert response.status_code == 204
    assert all(transaction["id"] != transaction_id for transaction in list_response.json())


def test_transactions_require_auth() -> None:
    with TestClient(app) as client:
        response = client.get("/transactions")

    assert response.status_code == 401
