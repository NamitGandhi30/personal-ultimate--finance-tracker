from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str
    username: str


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    description: str = Field(min_length=1, max_length=240)
    category: str = Field(min_length=1, max_length=80)
    merchant: str = Field(min_length=1, max_length=120)
    is_income: bool = False
    trip_id: int | None = Field(default=None, gt=0)


class TransactionUpdate(TransactionCreate):
    pass


class TransactionRead(TransactionCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: datetime


class TransactionTripUpdate(BaseModel):
    trip_id: int | None = Field(default=None, gt=0)


class TripCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    destination: str = Field(min_length=1, max_length=120)
    budget: float = Field(default=0, ge=0)


class TripRead(TripCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
