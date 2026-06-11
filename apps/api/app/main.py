from contextlib import asynccontextmanager
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import create_token, require_auth
from app.categorization import categorize
from app.database import check_db, database_kind, init_db, session_scope
from app.intelligence import build_forecast, build_historical_insights, scan_receipt
from app.repositories import TransactionRepository, TripRepository, UserRepository, FixedTransactionRepository, FixedTransactionOverrideRepository
from app.schemas import (
    CategorizeRequest,
    CategorizeResponse,
    ForecastResponse,
    HistoricalInsightsResponse,
    LoginRequest,
    LoginResponse,
    ReceiptScanRequest,
    ReceiptScanResponse,
    RegisterRequest,
    TransactionCreate,
    TransactionRead,
    TransactionTripUpdate,
    TransactionUpdate,
    TripCreate,
    TripRead,
    TripUpdate,
    UserRead,
    FixedTransactionCreate,
    FixedTransactionRead,
    FixedTransactionUpdate,
    FixedTransactionOverrideCreate,
    FixedTransactionOverrideRead,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Iterator[None]:
    init_db()
    with session_scope() as session:
        UserRepository(session).seed_admin()
        TransactionRepository(session, username="admin").seed_defaults()
    yield


app = FastAPI(title="PUFT API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_session() -> Iterator[Session]:
    with session_scope() as session:
        yield session


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def database_health() -> dict[str, str]:
    check_db()
    return {"status": "ok", "database": "connected", "provider": database_kind()}


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    with session_scope() as session:
        user = UserRepository(session).authenticate(payload.username, payload.password)
        auth_username = user.username if user is not None else ""
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return LoginResponse(token=create_token(auth_username), username=auth_username)


@app.post("/auth/register", response_model=LoginResponse, status_code=201)
def register(payload: RegisterRequest) -> LoginResponse:
    with session_scope() as session:
        users = UserRepository(session)
        if users.username_or_email_exists(payload.username, payload.email):
            raise HTTPException(status_code=409, detail="Username or email is already registered")
        user = users.create(payload)
        auth_username = user.username
        return LoginResponse(token=create_token(auth_username), username=auth_username)


@app.get("/auth/me", response_model=UserRead)
def me(
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> UserRead:
    user = UserRepository(session).get_by_username(username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/categorize", response_model=CategorizeResponse)
def categorize_transaction(
    payload: CategorizeRequest,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> CategorizeResponse:
    user = UserRepository(session).get_by_username(username)
    suggestion = categorize(
        session,
        user,
        payload.description,
        merchant=payload.merchant,
        is_income=payload.is_income,
    )
    return CategorizeResponse(**suggestion)


@app.post("/receipts/scan", response_model=ReceiptScanResponse)
def scan_receipt_endpoint(
    payload: ReceiptScanRequest,
    username: str = Depends(require_auth),
) -> ReceiptScanResponse:
    if not (payload.image_base64 or "").strip() and not (payload.extracted_text or "").strip():
        raise HTTPException(status_code=400, detail="Provide image_base64 or extracted_text")
    return scan_receipt(
        image_base64=payload.image_base64,
        extracted_text=payload.extracted_text,
        filename=payload.filename,
        use_ai_parser=payload.use_ai_parser,
    )


@app.get("/insights/forecast", response_model=ForecastResponse)
def forecast_insights(
    horizon_days: int = Query(default=30, ge=1, le=90),
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> ForecastResponse:
    transactions = TransactionRepository(session, username).list()
    return build_forecast(transactions, horizon_days=horizon_days)


@app.get("/insights/history", response_model=HistoricalInsightsResponse)
def historical_insights(
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> HistoricalInsightsResponse:
    transactions = TransactionRepository(session, username).list()
    return build_historical_insights(transactions)


@app.get("/transactions", response_model=list[TransactionRead])
def list_transactions(
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> list[TransactionRead]:
    return TransactionRepository(session, username).list()


@app.post("/transactions", response_model=TransactionRead, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> TransactionRead:
    try:
        transaction = TransactionRepository(session, username).create(payload)
        session.commit()
        return transaction
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/transactions/{transaction_id}/trip", response_model=TransactionRead)
def update_transaction_trip(
    transaction_id: int,
    payload: TransactionTripUpdate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> TransactionRead:
    try:
        transaction = TransactionRepository(session, username).update_trip(transaction_id, payload)
        if transaction is None:
            raise HTTPException(status_code=404, detail="Transaction not found")
        session.commit()
        return transaction
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/transactions/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> TransactionRead:
    try:
        transaction = TransactionRepository(session, username).update(transaction_id, payload)
        if transaction is None:
            raise HTTPException(status_code=404, detail="Transaction not found")
        session.commit()
        return transaction
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> None:
    deleted = TransactionRepository(session, username).delete(transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
    session.commit()


@app.get("/trips", response_model=list[TripRead])
def list_trips(
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> list[TripRead]:
    return TripRepository(session, username).list()


@app.post("/trips", response_model=TripRead, status_code=201)
def create_trip(
    payload: TripCreate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> TripRead:
    trip = TripRepository(session, username).create(payload)
    session.commit()
    return trip


@app.put("/trips/{trip_id}", response_model=TripRead)
def update_trip(
    trip_id: int,
    payload: TripUpdate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> TripRead:
    trip = TripRepository(session, username).update(trip_id, payload)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    session.commit()
    return trip


@app.delete("/trips/{trip_id}", status_code=204)
def delete_trip(
    trip_id: int,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> None:
    deleted = TripRepository(session, username).delete(trip_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trip not found")
    session.commit()


@app.get("/fixed-transactions", response_model=list[FixedTransactionRead])
def list_fixed_transactions(
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> list[FixedTransactionRead]:
    return FixedTransactionRepository(session, username).list()


@app.post("/fixed-transactions", response_model=FixedTransactionRead)
def create_fixed_transaction(
    payload: FixedTransactionCreate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> FixedTransactionRead:
    fixed = FixedTransactionRepository(session, username).create(payload)
    session.commit()
    return fixed


@app.put("/fixed-transactions/{fixed_id}", response_model=FixedTransactionRead)
def update_fixed_transaction(
    fixed_id: int,
    payload: FixedTransactionUpdate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> FixedTransactionRead:
    fixed = FixedTransactionRepository(session, username).update(fixed_id, payload)
    if fixed is None:
        raise HTTPException(status_code=404, detail="Fixed transaction not found")
    session.commit()
    return fixed


@app.delete("/fixed-transactions/{fixed_id}", status_code=204)
def delete_fixed_transaction(
    fixed_id: int,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> None:
    deleted = FixedTransactionRepository(session, username).delete(fixed_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Fixed transaction not found")
    session.commit()


@app.post("/fixed-transactions/overrides", response_model=FixedTransactionOverrideRead)
def create_or_update_override(
    payload: FixedTransactionOverrideCreate,
    session: Session = Depends(get_session),
    username: str = Depends(require_auth),
) -> FixedTransactionOverrideRead:
    try:
        override = FixedTransactionOverrideRepository(session, username).create_or_update(payload)
        session.commit()
        return override
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


