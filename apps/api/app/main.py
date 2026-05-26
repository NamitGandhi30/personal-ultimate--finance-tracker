from datetime import datetime, timezone
from itertools import count
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    description: str = Field(min_length=1)
    category: str = Field(min_length=1)
    merchant: str = Field(min_length=1)
    is_income: bool = False


class Transaction(TransactionCreate):
    id: int
    date: datetime


app = FastAPI(title="PUFT API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_id_sequence = count(4)
_transactions: List[Transaction] = [
    Transaction(
        id=1,
        amount=250,
        description="Lunch at Swiggy",
        category="Food",
        merchant="Swiggy",
        date=datetime.now(timezone.utc),
        is_income=False,
    ),
    Transaction(
        id=2,
        amount=800,
        description="Petrol",
        category="Transport",
        merchant="Fuel",
        date=datetime.now(timezone.utc),
        is_income=False,
    ),
    Transaction(
        id=3,
        amount=50000,
        description="Salary",
        category="Income",
        merchant="Employer",
        date=datetime.now(timezone.utc),
        is_income=True,
    ),
]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/transactions", response_model=list[Transaction])
def list_transactions() -> list[Transaction]:
    return sorted(_transactions, key=lambda item: item.date, reverse=True)


@app.post("/transactions", response_model=Transaction, status_code=201)
def create_transaction(payload: TransactionCreate) -> Transaction:
    transaction = Transaction(
        id=next(_id_sequence),
        date=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    _transactions.insert(0, transaction)
    return transaction
