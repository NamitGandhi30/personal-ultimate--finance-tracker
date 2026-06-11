import base64
import io
import json
import math
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.ai_providers import configured_providers, generate
from app.categorization import suggest_category_keywords
from app.models import TransactionModel


AI_RECEIPT_PROMPT = (
    "Extract receipt data as strict JSON only. Shape: "
    '{"amount": number, "description": string, "category": string, "merchant": string, '
    '"confidence": number, "warnings": string[]}. '
    "Use INR-friendly amounts. Category must be one of Food, Groceries, Transport, Utilities, "
    "Shopping, Healthcare, Travel, Housing, Subscriptions, General. Do not include markdown."
)


@dataclass(frozen=True)
class DailySpend:
    day: date
    amount: float


def build_forecast(transactions: list[TransactionModel], horizon_days: int = 30) -> dict:
    daily = _daily_spend(transactions)
    if not daily:
        return {
            "model": "sequence_forecast_fallback",
            "horizon_days": horizon_days,
            "projected_total": 0,
            "confidence": 0.2,
            "trend": "flat",
            "peak_day": None,
            "points": [],
            "category_pressure": [],
            "insights": ["Add expense history to unlock spending forecasts."],
        }

    values = [item.amount for item in daily]
    predictions: list[float] = []
    rolling = values[:]

    for step in range(horizon_days):
        prediction = _predict_next_value(rolling, step)
        predictions.append(prediction)
        rolling.append(prediction)

    last_day = daily[-1].day
    points = [
        {
            "date": (last_day + timedelta(days=index + 1)).isoformat(),
            "amount": round(amount, 2),
        }
        for index, amount in enumerate(predictions)
    ]
    projected_total = round(sum(predictions), 2)
    recent_average = _mean(values[-7:])
    future_average = _mean(predictions[:7])
    trend_delta = future_average - recent_average
    trend = "flat"
    if trend_delta > max(50, recent_average * 0.08):
        trend = "rising"
    elif trend_delta < -max(50, recent_average * 0.08):
        trend = "falling"

    peak_index, peak_value = max(enumerate(predictions), key=lambda item: item[1])
    volatility = _stddev(values[-14:]) / max(_mean(values[-14:]), 1)
    confidence = max(0.35, min(0.92, 0.9 - volatility * 0.25 + min(len(values), 60) / 300))
    category_pressure = _category_pressure(transactions)

    return {
        "model": "lstm_ready_recursive_sequence",
        "horizon_days": horizon_days,
        "projected_total": projected_total,
        "confidence": round(confidence, 2),
        "trend": trend,
        "peak_day": {
            "date": (last_day + timedelta(days=peak_index + 1)).isoformat(),
            "amount": round(peak_value, 2),
        },
        "points": points,
        "category_pressure": category_pressure,
        "insights": _forecast_insights(trend, projected_total, confidence, category_pressure),
    }


def build_historical_insights(transactions: list[TransactionModel]) -> dict:
    expenses = [transaction for transaction in transactions if not transaction.is_income]
    monthly: dict[str, float] = defaultdict(float)
    category_months: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    categories: dict[str, float] = defaultdict(float)

    for transaction in expenses:
        month = transaction.date.strftime("%Y-%m")
        monthly[month] += transaction.amount
        category_months[transaction.category][month] += transaction.amount
        categories[transaction.category] += transaction.amount

    monthly_points = [{"month": key, "amount": round(value, 2)} for key, value in sorted(monthly.items())]
    category_trends = [
        {
            "category": category,
            "points": [{"month": key, "amount": round(value, 2)} for key, value in sorted(months.items())],
        }
        for category, months in sorted(category_months.items())
    ]
    rankings = [
        {"category": category, "amount": round(amount, 2)}
        for category, amount in sorted(categories.items(), key=lambda item: item[1], reverse=True)
    ]

    mom_change = 0.0
    if len(monthly_points) >= 2:
        previous = monthly_points[-2]["amount"]
        current = monthly_points[-1]["amount"]
        mom_change = 0 if previous == 0 else ((current - previous) / previous) * 100

    direction = "flat"
    if mom_change > 5:
        direction = "up"
    elif mom_change < -5:
        direction = "down"

    return {
        "monthly": monthly_points,
        "category_trends": category_trends,
        "top_categories": rankings[:6],
        "month_over_month": {
            "change_percent": round(mom_change, 1),
            "direction": direction,
        },
        "insights": _historical_insights(monthly_points, rankings, direction, mom_change),
    }


def scan_receipt(
    image_base64: str | None = None,
    extracted_text: str | None = None,
    filename: str | None = None,
    use_ai_parser: bool = True,
) -> dict:
    text = (extracted_text or "").strip()
    ocr_available = False
    warnings: list[str] = []
    ai_providers = configured_providers() if use_ai_parser else []
    ai_provider: str | None = None
    ai_result: dict | None = None

    if image_base64 and not text:
        text, ocr_available, ocr_warning = _try_ocr(image_base64)
        if ocr_warning:
            warnings.append(ocr_warning)

    if ai_providers:
        prompt = f"{AI_RECEIPT_PROMPT}\nOCR text if any:\n{text or '(none)'}"
        content, used_provider, ai_warnings = generate(prompt, image_base64, providers=ai_providers)
        warnings.extend(ai_warnings)
        if content is not None:
            ai_result = _normalize_ai_receipt(content)
            if ai_result is not None:
                ai_provider = used_provider
            else:
                warnings.append(f"AI parser ({used_provider}) returned no receipt details.")
    elif use_ai_parser:
        warnings.append("AI parser is not configured. Set AI_PROVIDER plus a provider key, or paste receipt text.")

    parsed = ai_result or parse_receipt_text(text)
    confidence = parsed["confidence"]
    if ai_result is not None:
        confidence = max(confidence, 0.72)
    elif not ocr_available and image_base64 and not text:
        confidence = min(confidence, 0.25)

    return {
        "filename": filename or "receipt",
        "ai_provider": ai_provider if ai_result is not None else None,
        "ocr_available": ocr_available,
        "raw_text": text,
        "confidence": confidence,
        "needs_review": confidence < 0.7,
        "transaction": {
            "amount": parsed["amount"],
            "description": parsed["description"],
            "category": parsed["category"],
            "merchant": parsed["merchant"],
            "is_income": False,
            "trip_id": None,
        },
        "warnings": warnings
        + parsed["warnings"]
        + ([] if ai_result is not None or ocr_available or text else ["OCR/AI extraction unavailable. Enter details manually."]),
    }


def parse_receipt_text(text: str) -> dict:
    warnings: list[str] = []
    lower = text.lower()
    amounts = [float(match) for match in re.findall(r"(?:rs\.?|inr|total|amount|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)", lower)]
    amount = max(amounts) if amounts else 0
    if amount <= 0:
        warnings.append("Could not detect a payable total.")

    merchant = _detect_merchant(text)
    if merchant == "Receipt":
        warnings.append("Merchant was not obvious.")

    category = suggest_category_keywords(lower)
    description = merchant if merchant != "Receipt" else "Receipt expense"
    confidence = 0.35
    if amount > 0:
        confidence += 0.35
    if merchant != "Receipt":
        confidence += 0.15
    if category != "General":
        confidence += 0.1

    return {
        "amount": round(amount, 2),
        "description": description,
        "category": category,
        "merchant": merchant,
        "confidence": round(min(confidence, 0.95), 2),
        "warnings": warnings,
    }


def _try_ocr(image_base64: str) -> tuple[str, bool, str | None]:
    try:
        from PIL import Image, ImageOps
        import pytesseract
    except ImportError:
        return "", False, "Local OCR dependencies are not installed. Run pip install -r apps/api/requirements.txt."

    try:
        tesseract_cmd = os.getenv("TESSERACT_CMD", "").strip()
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        pytesseract.get_tesseract_version()
        payload = image_base64.split(",", 1)[-1]
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(payload))))
        if image.mode not in {"L", "RGB"}:
            image = image.convert("RGB")
        return pytesseract.image_to_string(image).strip(), True, None
    except (base64.binascii.Error, OSError):
        return "", False, "Could not read this receipt image. Try a clearer JPG/PNG or paste receipt text."
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        return "", False, f"Local OCR engine is unavailable: {message}"


def _normalize_ai_receipt(content: str) -> dict | None:
    match = re.search(r"\{.*\}", content, flags=re.DOTALL)
    if not match:
        return None
    data = json.loads(match.group(0))
    amount = float(data.get("amount") or 0)
    merchant = str(data.get("merchant") or "Receipt").strip()[:120] or "Receipt"
    category = str(data.get("category") or "General").strip()[:80] or "General"
    description = str(data.get("description") or merchant).strip()[:240] or merchant
    confidence = float(data.get("confidence") or 0.75)
    warnings = data.get("warnings") if isinstance(data.get("warnings"), list) else []

    return {
        "amount": round(max(amount, 0), 2),
        "description": description,
        "category": category,
        "merchant": merchant,
        "confidence": round(max(0.0, min(confidence, 0.98)), 2),
        "warnings": [str(item) for item in warnings],
    }


def _daily_spend(transactions: list[TransactionModel]) -> list[DailySpend]:
    expenses = [transaction for transaction in transactions if not transaction.is_income]
    if not expenses:
        return []

    totals: dict[date, float] = defaultdict(float)
    for transaction in expenses:
        totals[transaction.date.date()] += transaction.amount

    first_day = min(totals)
    last_day = max(max(totals), datetime.now().date())
    cursor = first_day
    result: list[DailySpend] = []
    while cursor <= last_day:
        result.append(DailySpend(day=cursor, amount=totals[cursor]))
        cursor += timedelta(days=1)
    return result


def _predict_next_value(values: list[float], step: int) -> float:
    recent = values[-7:] or [0]
    broader = values[-30:] or recent
    recent_average = _mean(recent)
    broader_average = _mean(broader)
    drift = (recent_average - broader_average) * 0.25
    weekday_factor = 1 + (0.06 * math.sin((step % 7) / 7 * math.tau))
    prediction = (recent_average * 0.65 + broader_average * 0.35 + drift) * weekday_factor
    upper = max(max(broader) * 1.25, broader_average * 2, 1)
    return max(0, min(prediction, upper))


def _category_pressure(transactions: list[TransactionModel]) -> list[dict]:
    recent_cutoff = datetime.now().date() - timedelta(days=30)
    totals: dict[str, float] = defaultdict(float)
    for transaction in transactions:
        if transaction.is_income or transaction.date.date() < recent_cutoff:
            continue
        totals[transaction.category] += transaction.amount

    total = sum(totals.values()) or 1
    return [
        {"category": category, "amount": round(amount, 2), "share": round(amount / total, 2)}
        for category, amount in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:5]
    ]


def _forecast_insights(trend: str, projected_total: float, confidence: float, pressure: list[dict]) -> list[str]:
    insights = [f"Projected 30-day spend is Rs {round(projected_total):,} with {round(confidence * 100)}% confidence."]
    if trend == "rising":
        insights.append("Spend rhythm is rising versus the recent baseline.")
    elif trend == "falling":
        insights.append("Spend rhythm is easing versus the recent baseline.")
    else:
        insights.append("Spend rhythm is stable across the forecast window.")
    if pressure:
        insights.append(f"{pressure[0]['category']} is the strongest category pressure right now.")
    return insights


def _historical_insights(monthly_points: list[dict], rankings: list[dict], direction: str, mom_change: float) -> list[str]:
    if not monthly_points:
        return ["Add expenses to build historical spending insights."]

    insights = [f"Month-over-month spend is {direction} by {abs(round(mom_change, 1))}%."]
    if rankings:
        insights.append(f"{rankings[0]['category']} is your top historical spending category.")
    if len(monthly_points) >= 3:
        insights.append("Monthly history is ready for trend comparison.")
    return insights


def _detect_merchant(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:5]:
        if not re.search(r"\d{3,}", line):
            return line[:120]
    return "Receipt"


def _mean(values: list[float]) -> float:
    return sum(values) / max(len(values), 1)


def _stddev(values: list[float]) -> float:
    if len(values) < 2:
        return 0
    average = _mean(values)
    return math.sqrt(sum((value - average) ** 2 for value in values) / len(values))
