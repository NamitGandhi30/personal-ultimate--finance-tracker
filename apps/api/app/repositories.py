from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TransactionModel, TripModel
from app.schemas import TransactionCreate, TransactionTripUpdate, TransactionUpdate, TripCreate


class TransactionRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[TransactionModel]:
        statement = select(TransactionModel).order_by(TransactionModel.date.desc())
        return list(self.session.scalars(statement).all())

    def create(self, payload: TransactionCreate) -> TransactionModel:
        transaction = TransactionModel(
            amount=payload.amount,
            description=payload.description,
            category=payload.category,
            merchant=payload.merchant,
            is_income=payload.is_income,
            trip_id=payload.trip_id,
            date=datetime.now(timezone.utc),
        )
        self.session.add(transaction)
        self.session.flush()
        self.session.refresh(transaction)
        return transaction

    def update_trip(self, transaction_id: int, payload: TransactionTripUpdate) -> TransactionModel | None:
        transaction = self.session.get(TransactionModel, transaction_id)
        if transaction is None:
            return None

        transaction.trip_id = payload.trip_id
        self.session.flush()
        self.session.refresh(transaction)
        return transaction

    def update(self, transaction_id: int, payload: TransactionUpdate) -> TransactionModel | None:
        transaction = self.session.get(TransactionModel, transaction_id)
        if transaction is None:
            return None

        transaction.amount = payload.amount
        transaction.description = payload.description
        transaction.category = payload.category
        transaction.merchant = payload.merchant
        transaction.is_income = payload.is_income
        transaction.trip_id = payload.trip_id
        self.session.flush()
        self.session.refresh(transaction)
        return transaction

    def delete(self, transaction_id: int) -> bool:
        transaction = self.session.get(TransactionModel, transaction_id)
        if transaction is None:
            return False

        self.session.delete(transaction)
        self.session.flush()
        return True

    def seed_defaults(self) -> None:
        exists = self.session.scalar(select(TransactionModel.id).limit(1))
        if exists is not None:
            return

        self.session.add_all(
            [
                TransactionModel(
                    amount=250,
                    description="Lunch at Swiggy",
                    category="Food",
                    merchant="Swiggy",
                    is_income=False,
                    date=datetime(2026, 5, 26, tzinfo=timezone.utc),
                ),
                TransactionModel(
                    amount=800,
                    description="Petrol",
                    category="Transport",
                    merchant="Fuel",
                    is_income=False,
                    date=datetime(2026, 5, 25, tzinfo=timezone.utc),
                ),
                TransactionModel(
                    amount=50000,
                    description="Salary",
                    category="Income",
                    merchant="Employer",
                    is_income=True,
                    date=datetime(2026, 5, 23, tzinfo=timezone.utc),
                ),
            ]
        )


class TripRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[TripModel]:
        statement = select(TripModel).order_by(TripModel.created_at.desc())
        return list(self.session.scalars(statement).all())

    def create(self, payload: TripCreate) -> TripModel:
        trip = TripModel(
            name=payload.name,
            destination=payload.destination,
            budget=payload.budget,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(trip)
        self.session.flush()
        self.session.refresh(trip)
        return trip
