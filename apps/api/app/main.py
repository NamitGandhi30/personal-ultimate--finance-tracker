from contextlib import asynccontextmanager
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import create_token, require_auth
from app.database import check_db, database_kind, init_db, session_scope
from app.repositories import TransactionRepository, TripRepository, UserRepository
from app.schemas import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    TransactionCreate,
    TransactionRead,
    TransactionTripUpdate,
    TransactionUpdate,
    TripCreate,
    TripRead,
    TripUpdate,
    UserRead,
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

