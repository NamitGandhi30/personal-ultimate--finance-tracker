from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

import secrets
from datetime import timedelta

from app.auth import AUTH_PASSWORD, AUTH_USERNAME, hash_password, verify_password
from app.categorization import AUTO_CATEGORY_VALUES, categorize, learn_correction
from app.models import (
    ChannelLinkModel,
    FixedTransactionModel,
    FixedTransactionOverrideModel,
    TransactionModel,
    TripModel,
    UserModel,
)
from app.schemas import RegisterRequest, TransactionCreate, TransactionTripUpdate, TransactionUpdate, TripCreate, TripUpdate, FixedTransactionCreate, FixedTransactionUpdate, FixedTransactionOverrideCreate


class VirtualTransaction:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class TransactionRepository:
    def __init__(self, session: Session, username: str | None = None) -> None:
        self.session = session
        self.user = UserRepository(session).get_by_username(username) if username else None

    def list(self) -> list[TransactionModel]:
        import calendar
        from datetime import datetime, timezone, timedelta

        # Get manual transactions
        statement = select(TransactionModel).order_by(TransactionModel.date.desc())
        if self.user is not None:
            statement = statement.where(TransactionModel.user_id == self.user.id)
        manual_txs = list(self.session.scalars(statement).all())

        # If no user logged in, just return manual ones
        if self.user is None:
            return manual_txs

        # Get fixed transactions for this user
        fixed_statement = select(FixedTransactionModel).where(FixedTransactionModel.user_id == self.user.id)
        fixed_list = list(self.session.scalars(fixed_statement).all())

        # Get overrides
        override_statement = select(FixedTransactionOverrideModel).join(FixedTransactionModel).where(FixedTransactionModel.user_id == self.user.id)
        overrides = list(self.session.scalars(override_statement).all())
        override_dict = {
            (o.fixed_transaction_id, o.occurrence_date): o for o in overrides
        }

        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = now.month

        projected = []

        def add_occurrence(fixed, occurrence_dt, occurrence_str, year_val, month_val):
            # Check override
            override = override_dict.get((fixed.id, occurrence_str))
            
            amount = fixed.amount
            status = "scheduled"
            actual_dt = occurrence_dt
            
            if override:
                status = override.status
                if override.amount_override is not None:
                    amount = override.amount_override
                if override.actual_date is not None:
                    actual_dt = override.actual_date

            # Calculate unique virtual id
            virtual_id = 100000000 + fixed.id * 10000 + (year_val - 2000) * 12 + month_val
            
            # Clamp to 0 if cancelled
            if status == "cancelled":
                amount = 0.0

            projected.append(VirtualTransaction(
                id=virtual_id,
                user_id=fixed.user_id,
                amount=amount,
                description=fixed.description,
                category=fixed.category,
                merchant=fixed.merchant,
                is_income=fixed.is_income,
                trip_id=None,
                date=actual_dt,
                is_fixed=True,
                fixed_id=fixed.id,
                status=status,
                occurrence_date=occurrence_str
            ))

        for fixed in fixed_list:
            start_dt = fixed.start_date
            
            if fixed.frequency == "monthly":
                y = start_dt.year
                m = start_dt.month
                while (y < current_year) or (y == current_year and m <= current_month):
                    max_days = calendar.monthrange(y, m)[1]
                    day = min(fixed.day_of_month, max_days)
                    occurrence_dt = datetime(y, m, day, tzinfo=timezone.utc)
                    
                    if occurrence_dt.date() >= start_dt.date():
                        if fixed.end_date and occurrence_dt.date() > fixed.end_date.date():
                            break
                        occurrence_str = f"{y:04d}-{m:02d}-{day:02d}"
                        add_occurrence(fixed, occurrence_dt, occurrence_str, y, m)
                    
                    if m == 12:
                        m = 1
                        y += 1
                    else:
                        m += 1

            elif fixed.frequency == "weekly":
                curr = start_dt
                last_day = calendar.monthrange(current_year, current_month)[1]
                end_limit = datetime(current_year, current_month, last_day, 23, 59, 59, tzinfo=timezone.utc)
                while curr <= end_limit:
                    if fixed.end_date and curr.date() > fixed.end_date.date():
                        break
                    occurrence_str = curr.strftime("%Y-%m-%d")
                    add_occurrence(fixed, curr, occurrence_str, curr.year, curr.month)
                    curr += timedelta(days=7)

            elif fixed.frequency == "yearly":
                y = start_dt.year
                m = start_dt.month
                day = start_dt.day
                while y <= current_year:
                    max_days = calendar.monthrange(y, m)[1]
                    d = min(day, max_days)
                    occurrence_dt = datetime(y, m, d, tzinfo=timezone.utc)
                    
                    if occurrence_dt.date() >= start_dt.date():
                        if fixed.end_date and occurrence_dt.date() > fixed.end_date.date():
                            break
                        occurrence_str = f"{y:04d}-{m:02d}-{d:02d}"
                        add_occurrence(fixed, occurrence_dt, occurrence_str, y, m)
                    y += 1

        # Combine, sort descending by date
        combined = list(manual_txs) + projected
        combined.sort(key=lambda t: t.date, reverse=True)
        return combined

    def create(self, payload: TransactionCreate) -> TransactionModel:
        if payload.trip_id is not None and not self._owns_trip(payload.trip_id):
            raise ValueError("Trip does not belong to this user")

        category = payload.category.strip()
        if category.lower() in AUTO_CATEGORY_VALUES:
            suggestion = categorize(
                self.session,
                self.user,
                payload.description,
                merchant=payload.merchant,
                is_income=payload.is_income,
            )
            category = suggestion["category"]

        transaction = TransactionModel(
            user_id=self.user.id if self.user is not None else None,
            amount=payload.amount,
            description=payload.description,
            category=category,
            merchant=payload.merchant,
            is_income=payload.is_income,
            trip_id=payload.trip_id,
            date=payload.date if payload.date is not None else datetime.now(timezone.utc),
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

        new_category = payload.category.strip()
        if new_category.lower() in {"", "auto"}:
            new_category = categorize(
                self.session,
                self.user,
                payload.description,
                merchant=payload.merchant,
                is_income=payload.is_income,
            )["category"]
        elif new_category != transaction.category:
            # The user corrected the category — remember the mapping.
            learn_correction(self.session, self.user, payload.merchant, payload.description, new_category)

        transaction.amount = payload.amount
        transaction.description = payload.description
        transaction.category = new_category
        transaction.merchant = payload.merchant
        transaction.is_income = payload.is_income
        transaction.trip_id = payload.trip_id
        if payload.date is not None:
            transaction.date = payload.date
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


class FixedTransactionRepository:
    def __init__(self, session: Session, username: str | None = None) -> None:
        self.session = session
        self.user = UserRepository(session).get_by_username(username) if username else None

    def list(self) -> list[FixedTransactionModel]:
        statement = select(FixedTransactionModel).order_by(FixedTransactionModel.start_date.desc())
        if self.user is not None:
            statement = statement.where(FixedTransactionModel.user_id == self.user.id)
        return list(self.session.scalars(statement).all())

    def create(self, payload: FixedTransactionCreate) -> FixedTransactionModel:
        fixed = FixedTransactionModel(
            user_id=self.user.id if self.user is not None else None,
            amount=payload.amount,
            description=payload.description,
            category=payload.category,
            merchant=payload.merchant,
            is_income=payload.is_income,
            frequency=payload.frequency,
            day_of_month=payload.day_of_month,
            start_date=payload.start_date if payload.start_date is not None else datetime.now(timezone.utc),
            end_date=payload.end_date,
        )
        self.session.add(fixed)
        self.session.flush()
        self.session.refresh(fixed)
        return fixed

    def update(self, fixed_id: int, payload: FixedTransactionUpdate) -> FixedTransactionModel | None:
        fixed = self._get_owned_fixed(fixed_id)
        if fixed is None:
            return None
        fixed.amount = payload.amount
        fixed.description = payload.description
        fixed.category = payload.category
        fixed.merchant = payload.merchant
        fixed.is_income = payload.is_income
        fixed.frequency = payload.frequency
        fixed.day_of_month = payload.day_of_month
        if payload.start_date is not None:
            fixed.start_date = payload.start_date
        fixed.end_date = payload.end_date
        self.session.flush()
        self.session.refresh(fixed)
        return fixed

    def delete(self, fixed_id: int) -> bool:
        fixed = self._get_owned_fixed(fixed_id)
        if fixed is None:
            return False
        self.session.delete(fixed)
        self.session.flush()
        return True

    def _get_owned_fixed(self, fixed_id: int) -> FixedTransactionModel | None:
        statement = select(FixedTransactionModel).where(FixedTransactionModel.id == fixed_id)
        if self.user is not None:
            statement = statement.where(FixedTransactionModel.user_id == self.user.id)
        return self.session.scalars(statement).first()


class FixedTransactionOverrideRepository:
    def __init__(self, session: Session, username: str | None = None) -> None:
        self.session = session
        self.user = UserRepository(session).get_by_username(username) if username else None

    def list(self) -> list[FixedTransactionOverrideModel]:
        statement = select(FixedTransactionOverrideModel).join(FixedTransactionModel)
        if self.user is not None:
            statement = statement.where(FixedTransactionModel.user_id == self.user.id)
        return list(self.session.scalars(statement).all())

    def create_or_update(self, payload: FixedTransactionOverrideCreate) -> FixedTransactionOverrideModel:
        statement = select(FixedTransactionModel).where(FixedTransactionModel.id == payload.fixed_transaction_id)
        if self.user is not None:
            statement = statement.where(FixedTransactionModel.user_id == self.user.id)
        fixed = self.session.scalars(statement).first()
        if fixed is None:
            raise ValueError("Fixed transaction not found or access denied")

        statement = select(FixedTransactionOverrideModel).where(
            FixedTransactionOverrideModel.fixed_transaction_id == payload.fixed_transaction_id,
            FixedTransactionOverrideModel.occurrence_date == payload.occurrence_date
        )
        override = self.session.scalars(statement).first()

        if override is not None:
            override.status = payload.status
            override.actual_date = payload.actual_date
            override.amount_override = payload.amount_override
        else:
            override = FixedTransactionOverrideModel(
                fixed_transaction_id=payload.fixed_transaction_id,
                occurrence_date=payload.occurrence_date,
                status=payload.status,
                actual_date=payload.actual_date,
                amount_override=payload.amount_override
            )
            self.session.add(override)
        
        self.session.flush()
        self.session.refresh(override)
        return override


LINK_CODE_TTL = timedelta(minutes=15)
# Avoid easily-confused characters (0/O, 1/I) in the human-typed code.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class ChannelLinkRepository:
    """Manages chat-platform identity links and pending link codes."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def start_link(self, user: UserModel, length: int = 6) -> str:
        """Issue a fresh pending link code for a user, replacing any prior one."""
        self.session.query(ChannelLinkModel).filter(
            ChannelLinkModel.user_id == user.id,
            ChannelLinkModel.verified.is_(False),
        ).delete()

        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))
        self.session.add(ChannelLinkModel(user_id=user.id, code=code, verified=False))
        self.session.flush()
        return code

    def claim_code(self, code: str, platform: str, external_id: str, display_name: str | None) -> UserModel | None:
        """Bind a platform identity to the user who owns this pending code."""
        normalized = code.strip().upper()
        pending = self.session.scalars(
            select(ChannelLinkModel).where(
                ChannelLinkModel.code == normalized,
                ChannelLinkModel.verified.is_(False),
            )
        ).first()
        if pending is None:
            return None
        if _aware(pending.created_at) < datetime.now(timezone.utc) - LINK_CODE_TTL:
            self.session.delete(pending)
            self.session.flush()
            return None

        user = self.session.get(UserModel, pending.user_id)
        if user is None:
            return None

        # Re-link: if this identity was already linked, repoint it to the new user.
        existing = self.session.scalars(
            select(ChannelLinkModel).where(
                ChannelLinkModel.platform == platform,
                ChannelLinkModel.external_id == external_id,
                ChannelLinkModel.verified.is_(True),
            )
        ).first()
        if existing is not None:
            existing.user_id = pending.user_id
            existing.display_name = display_name
            self.session.delete(pending)
        else:
            pending.platform = platform
            pending.external_id = external_id
            pending.display_name = display_name
            pending.code = None
            pending.verified = True

        self.session.flush()
        return user

    def resolve_user(self, platform: str, external_id: str) -> UserModel | None:
        link = self.session.scalars(
            select(ChannelLinkModel).where(
                ChannelLinkModel.platform == platform,
                ChannelLinkModel.external_id == external_id,
                ChannelLinkModel.verified.is_(True),
            )
        ).first()
        if link is None:
            return None
        return self.session.get(UserModel, link.user_id)

    def list_for_user(self, user: UserModel) -> list[ChannelLinkModel]:
        return list(
            self.session.scalars(
                select(ChannelLinkModel).where(
                    ChannelLinkModel.user_id == user.id,
                    ChannelLinkModel.verified.is_(True),
                )
            ).all()
        )

    def unlink(self, user: UserModel, platform: str) -> bool:
        deleted = (
            self.session.query(ChannelLinkModel)
            .filter(
                ChannelLinkModel.user_id == user.id,
                ChannelLinkModel.platform == platform,
                ChannelLinkModel.verified.is_(True),
            )
            .delete()
        )
        self.session.flush()
        return bool(deleted)


def _aware(value: datetime) -> datetime:
    """SQLite round-trips naive datetimes; treat those as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
