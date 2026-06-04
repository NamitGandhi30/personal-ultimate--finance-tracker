from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import AUTH_PASSWORD, AUTH_USERNAME, hash_password, verify_password
from app.models import TransactionModel, TripModel, UserModel
from app.schemas import RegisterRequest, TransactionCreate, TransactionTripUpdate, TransactionUpdate, TripCreate, TripUpdate


class TransactionRepository:
    def __init__(self, session: Session, username: str | None = None) -> None:
        self.session = session
        self.user = UserRepository(session).get_by_username(username) if username else None

    def list(self) -> list[TransactionModel]:
        statement = select(TransactionModel).order_by(TransactionModel.date.desc())
        if self.user is not None:
            statement = statement.where(TransactionModel.user_id == self.user.id)
        return list(self.session.scalars(statement).all())

    def create(self, payload: TransactionCreate) -> TransactionModel:
        if payload.trip_id is not None and not self._owns_trip(payload.trip_id):
            raise ValueError("Trip does not belong to this user")

        transaction = TransactionModel(
            user_id=self.user.id if self.user is not None else None,
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
        transaction = self._get_owned_transaction(transaction_id)
        if transaction is None:
            return None
        if payload.trip_id is not None and not self._owns_trip(payload.trip_id):
            raise ValueError("Trip does not belong to this user")

        transaction.trip_id = payload.trip_id
        self.session.flush()
        self.session.refresh(transaction)
        return transaction

    def update(self, transaction_id: int, payload: TransactionUpdate) -> TransactionModel | None:
        transaction = self._get_owned_transaction(transaction_id)
        if transaction is None:
            return None
        if payload.trip_id is not None and not self._owns_trip(payload.trip_id):
            raise ValueError("Trip does not belong to this user")

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
        transaction = self._get_owned_transaction(transaction_id)
        if transaction is None:
            return False

        self.session.delete(transaction)
        self.session.flush()
        return True

    def _get_owned_transaction(self, transaction_id: int) -> TransactionModel | None:
        statement = select(TransactionModel).where(TransactionModel.id == transaction_id)
        if self.user is not None:
            statement = statement.where(TransactionModel.user_id == self.user.id)
        return self.session.scalars(statement).first()

    def _owns_trip(self, trip_id: int) -> bool:
        if self.user is None:
            return True
        return (
            self.session.scalar(
                select(TripModel.id).where(TripModel.id == trip_id, TripModel.user_id == self.user.id).limit(1)
            )
            is not None
        )

    def seed_defaults(self) -> None:
        statement = select(TransactionModel.id).limit(1)
        if self.user is not None:
            statement = statement.where(TransactionModel.user_id == self.user.id)
        exists = self.session.scalar(statement)
        if exists is not None:
            return

        self.session.add_all(
            [
                TransactionModel(
                    user_id=self.user.id if self.user is not None else None,
                    amount=250,
                    description="Lunch at Swiggy",
                    category="Food",
                    merchant="Swiggy",
                    is_income=False,
                    date=datetime(2026, 5, 26, tzinfo=timezone.utc),
                ),
                TransactionModel(
                    user_id=self.user.id if self.user is not None else None,
                    amount=800,
                    description="Petrol",
                    category="Transport",
                    merchant="Fuel",
                    is_income=False,
                    date=datetime(2026, 5, 25, tzinfo=timezone.utc),
                ),
                TransactionModel(
                    user_id=self.user.id if self.user is not None else None,
                    amount=50000,
                    description="Salary",
                    category="Income",
                    merchant="Employer",
                    is_income=True,
                    date=datetime(2026, 5, 23, tzinfo=timezone.utc),
                ),
            ]
        )


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def seed_admin(self) -> None:
        exists = self.session.scalar(select(UserModel.id).where(UserModel.username == AUTH_USERNAME).limit(1))
        if exists is not None:
            return

        user = UserModel(
            username=AUTH_USERNAME,
            email=f"{AUTH_USERNAME}@local.puft",
            full_name="PUFT Admin",
            password_hash=hash_password(AUTH_PASSWORD),
            preferred_currency="INR",
        )
        self.session.add(user)

    def authenticate(self, username: str, password: str) -> UserModel | None:
        normalized = username.strip()
        statement = select(UserModel).where(
            or_(UserModel.username == normalized, UserModel.email == normalized.lower())
        )
        user = self.session.scalars(statement).first()
        if user is None or not verify_password(password, user.password_hash):
            return None
        return user

    def get_by_username(self, username: str | None) -> UserModel | None:
        if not username:
            return None
        statement = select(UserModel).where(UserModel.username == username.strip())
        return self.session.scalars(statement).first()

    def username_or_email_exists(self, username: str, email: str) -> bool:
        statement = select(UserModel.id).where(
            or_(UserModel.username == username.strip(), UserModel.email == email.strip().lower())
        )
        return self.session.scalar(statement) is not None

    def create(self, payload: RegisterRequest) -> UserModel:
        user = UserModel(
            username=payload.username.strip(),
            email=payload.email.strip().lower(),
            full_name=payload.full_name.strip(),
            password_hash=hash_password(payload.password),
            monthly_income=payload.monthly_income,
            savings_goal=payload.savings_goal,
            preferred_currency=payload.preferred_currency.strip().upper(),
        )
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user


class TripRepository:
    def __init__(self, session: Session, username: str | None = None) -> None:
        self.session = session
        self.user = UserRepository(session).get_by_username(username) if username else None

    def list(self) -> list[TripModel]:
        statement = select(TripModel).order_by(TripModel.created_at.desc())
        if self.user is not None:
            statement = statement.where(TripModel.user_id == self.user.id)
        return list(self.session.scalars(statement).all())

    def create(self, payload: TripCreate) -> TripModel:
        trip = TripModel(
            user_id=self.user.id if self.user is not None else None,
            name=payload.name,
            destination=payload.destination,
            budget=payload.budget,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(trip)
        self.session.flush()
        self.session.refresh(trip)
        return trip

    def update(self, trip_id: int, payload: TripUpdate) -> TripModel | None:
        trip = self._get_owned_trip(trip_id)
        if trip is None:
            return None
        trip.name = payload.name
        trip.destination = payload.destination
        trip.budget = payload.budget
        self.session.flush()
        self.session.refresh(trip)
        return trip

    def delete(self, trip_id: int) -> bool:
        trip = self._get_owned_trip(trip_id)
        if trip is None:
            return False
        # Nullify associated transactions
        self.session.query(TransactionModel).filter(TransactionModel.trip_id == trip_id).update({TransactionModel.trip_id: None})
        self.session.delete(trip)
        self.session.flush()
        return True

    def _get_owned_trip(self, trip_id: int) -> TripModel | None:
        statement = select(TripModel).where(TripModel.id == trip_id)
        if self.user is not None:
            statement = statement.where(TripModel.user_id == self.user.id)
        return self.session.scalars(statement).first()

