from contextlib import asynccontextmanager
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import create_token, require_auth, verify_credentials
from app.database import check_db, database_kind, init_db, session_scope
from app.repositories import TransactionRepository, TripRepository
from app.schemas import (
    LoginRequest,
    LoginResponse,
    TransactionCreate,
    TransactionRead,
    TransactionTripUpdate,
    TransactionUpdate,
    TripCreate,
    TripRead,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Iterator[None]:
    init_db()
    with session_scope() as session:
        TransactionRepository(session).seed_defaults()
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
    if not verify_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return LoginResponse(token=create_token(payload.username), username=payload.username)


@app.get("/transactions", response_model=list[TransactionRead])
def list_transactions(
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> list[TransactionRead]:
    return TransactionRepository(session).list()


@app.post("/transactions", response_model=TransactionRead, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> TransactionRead:
    return TransactionRepository(session).create(payload)


@app.patch("/transactions/{transaction_id}/trip", response_model=TransactionRead)
def update_transaction_trip(
    transaction_id: int,
    payload: TransactionTripUpdate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> TransactionRead:
    transaction = TransactionRepository(session).update_trip(transaction_id, payload)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@app.put("/transactions/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> TransactionRead:
    transaction = TransactionRepository(session).update(transaction_id, payload)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@app.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> None:
    deleted = TransactionRepository(session).delete(transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")


@app.get("/trips", response_model=list[TripRead])
def list_trips(
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> list[TripRead]:
    return TripRepository(session).list()


@app.post("/trips", response_model=TripRead, status_code=201)
def create_trip(
    payload: TripCreate,
    session: Session = Depends(get_session),
    _: str = Depends(require_auth),
) -> TripRead:
    return TripRepository(session).create(payload)
