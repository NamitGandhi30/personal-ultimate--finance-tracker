from fastapi.testclient import TestClient

from app.main import app  # test env is configured in conftest.py before this import


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


def test_scan_receipt_from_text() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.post(
            "/receipts/scan",
            headers=headers,
            json={
                "extracted_text": "Blue Tokai Coffee\nCappuccino x2\nTotal: 540.50",
                "filename": "coffee.jpg",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "coffee.jpg"
    assert body["transaction"]["amount"] == 540.50
    assert body["transaction"]["merchant"] == "Blue Tokai Coffee"
    assert body["transaction"]["is_income"] is False
    assert 0 <= body["confidence"] <= 1


def test_scan_receipt_requires_payload() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.post("/receipts/scan", headers=headers, json={})

    assert response.status_code == 400


def test_scan_receipt_requires_auth() -> None:
    with TestClient(app) as client:
        response = client.post("/receipts/scan", json={"extracted_text": "Total 100"})

    assert response.status_code == 401


def test_forecast_insights() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post(
            "/transactions",
            headers=headers,
            json={
                "amount": 2500,
                "description": "Weekly groceries",
                "category": "Groceries",
                "merchant": "Dmart",
                "is_income": False,
            },
        )
        response = client.get("/insights/forecast", headers=headers, params={"horizon_days": 14})

    assert response.status_code == 200
    body = response.json()
    assert body["horizon_days"] == 14
    assert len(body["points"]) == 14
    assert body["projected_total"] >= 0
    assert body["trend"] in {"rising", "falling", "flat"}
    assert body["insights"]


def test_forecast_insights_empty_history() -> None:
    with TestClient(app) as client:
        register = client.post(
            "/auth/register",
            json={
                "username": "forecastless",
                "email": "forecastless@example.com",
                "full_name": "No History",
                "password": "strong-password-1",
            },
        )
        headers = {"Authorization": f"Bearer {register.json()['token']}"}
        response = client.get("/insights/forecast", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["projected_total"] == 0
    assert body["points"] == []
    assert body["peak_day"] is None


def test_historical_insights() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post(
            "/transactions",
            headers=headers,
            json={
                "amount": 1800,
                "description": "Electricity bill",
                "category": "Utilities",
                "merchant": "BESCOM",
                "is_income": False,
            },
        )
        response = client.get("/insights/history", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["monthly"]
    assert any(item["category"] == "Utilities" for item in body["top_categories"])
    assert body["month_over_month"]["direction"] in {"up", "down", "flat"}
    assert body["insights"]


def test_insights_require_auth() -> None:
    with TestClient(app) as client:
        forecast = client.get("/insights/forecast")
        history = client.get("/insights/history")

    assert forecast.status_code == 401
    assert history.status_code == 401
