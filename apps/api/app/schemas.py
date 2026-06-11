from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str
    username: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    email: str = Field(min_length=5, max_length=240, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    monthly_income: float = Field(default=0, ge=0)
    savings_goal: float = Field(default=0, ge=0)
    preferred_currency: str = Field(default="INR", min_length=3, max_length=8)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    full_name: str
    monthly_income: float
    savings_goal: float
    preferred_currency: str
    created_at: datetime


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    description: str = Field(min_length=1, max_length=240)
    # Empty / "auto" / "General" means: let the server auto-categorize.
    category: str = Field(default="", max_length=80)
    merchant: str = Field(min_length=1, max_length=120)
    is_income: bool = False
    trip_id: int | None = Field(default=None, gt=0)
    date: datetime | None = Field(default=None)


class TransactionUpdate(TransactionCreate):
    pass


class TransactionRead(TransactionCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float = Field(ge=0)
    date: datetime
    is_fixed: bool = False
    fixed_id: int | None = None
    status: str = "scheduled"
    occurrence_date: str | None = None


class CategorizeRequest(BaseModel):
    description: str = Field(min_length=1, max_length=240)
    merchant: str = Field(default="", max_length=120)
    is_income: bool = False


class CategorizeResponse(BaseModel):
    category: str
    confidence: float
    source: str


class TransactionTripUpdate(BaseModel):
    trip_id: int | None = Field(default=None, gt=0)


class TripCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    destination: str = Field(min_length=1, max_length=120)
    budget: float = Field(default=0, ge=0)


class TripUpdate(TripCreate):
    pass



class TripRead(TripCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime

class FixedTransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    description: str = Field(min_length=1, max_length=240)
    category: str = Field(min_length=1, max_length=80)
    merchant: str = Field(min_length=1, max_length=120)
    is_income: bool = False
    frequency: str = Field(default="monthly", min_length=1, max_length=40)
    day_of_month: int = Field(default=1, ge=1, le=31)
    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)


class FixedTransactionUpdate(FixedTransactionCreate):
    pass


class FixedTransactionRead(FixedTransactionCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    start_date: datetime


class FixedTransactionOverrideCreate(BaseModel):
    fixed_transaction_id: int = Field(gt=0)
    occurrence_date: str = Field(min_length=10, max_length=40)  # "YYYY-MM-DD"
    status: str = Field(min_length=1, max_length=40)  # "scheduled", "paid", "paid_prior", "delayed", "cancelled"
    actual_date: datetime | None = Field(default=None)
    amount_override: float | None = Field(default=None, ge=0)


class FixedTransactionOverrideRead(FixedTransactionOverrideCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ReceiptScanRequest(BaseModel):
    image_base64: str | None = Field(default=None)
    extracted_text: str | None = Field(default=None, max_length=20000)
    filename: str | None = Field(default=None, max_length=240)
    use_ai_parser: bool = True


class ReceiptTransactionDraft(BaseModel):
    amount: float = Field(ge=0)
    description: str
    category: str
    merchant: str
    is_income: bool = False
    trip_id: int | None = None


class ReceiptScanResponse(BaseModel):
    filename: str
    ai_provider: str | None
    ocr_available: bool
    raw_text: str
    confidence: float
    needs_review: bool
    transaction: ReceiptTransactionDraft
    warnings: list[str]


class ForecastPoint(BaseModel):
    date: str
    amount: float


class CategoryPressure(BaseModel):
    category: str
    amount: float
    share: float


class ForecastResponse(BaseModel):
    model: str
    horizon_days: int
    projected_total: float
    confidence: float
    trend: str
    peak_day: ForecastPoint | None
    points: list[ForecastPoint]
    category_pressure: list[CategoryPressure]
    insights: list[str]


class MonthlyPoint(BaseModel):
    month: str
    amount: float


class CategoryTrend(BaseModel):
    category: str
    points: list[MonthlyPoint]


class CategoryRanking(BaseModel):
    category: str
    amount: float


class MonthOverMonth(BaseModel):
    change_percent: float
    direction: str


class HistoricalInsightsResponse(BaseModel):
    monthly: list[MonthlyPoint]
    category_trends: list[CategoryTrend]
    top_categories: list[CategoryRanking]
    month_over_month: MonthOverMonth
    insights: list[str]
