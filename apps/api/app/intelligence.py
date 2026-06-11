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
        text, ocr_available, ocr_warnings = _run_ocr(image_base64)
        warnings.extend(ocr_warnings)

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


_TOTAL_KEYWORDS = (
    "grand total",
    "amount payable",
    "net payable",
    "net amount",
    "amount due",
    "balance due",
    "total amount",
    "total",
    "amount paid",
)
_AMOUNT_PATTERN = re.compile(r"(?<![0-9.])([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![0-9.])")
_DATE_TIME_PATTERN = re.compile(r"\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b")


def _plausible_amounts(text: str) -> list[float]:
    candidates = []
    for raw in _AMOUNT_PATTERN.findall(_DATE_TIME_PATTERN.sub(" ", text)):
        digits = raw.replace(",", "")
        # Long digit runs without a decimal point are phone/GST/invoice numbers, not money.
        if "." not in digits and len(digits) > 6:
            continue
        value = float(digits)
        if 0 < value <= 1_000_000:
            candidates.append(value)
    return candidates


def _detect_amount(text: str) -> float:
    keyword_amounts: list[float] = []
    for line in text.splitlines():
        lower = line.lower()
        if "subtotal" in lower or "sub total" in lower or "sub-total" in lower:
            continue
        if any(keyword in lower for keyword in _TOTAL_KEYWORDS):
            amounts = _plausible_amounts(line)
            if amounts:
                keyword_amounts.append(max(amounts))
    if keyword_amounts:
        return max(keyword_amounts)
    amounts = _plausible_amounts(text)
    return max(amounts) if amounts else 0


def parse_receipt_text(text: str) -> dict:
    warnings: list[str] = []
    lower = text.lower()
    amount = _detect_amount(text)
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


# RapidOCR loads its ONNX models once per process (~1-2s); cache the engine.
_rapidocr_engine = None
_rapidocr_error: str | None = None


def _get_rapidocr():
    global _rapidocr_engine, _rapidocr_error
    if _rapidocr_engine is None and _rapidocr_error is None:
        try:
            from rapidocr_onnxruntime import RapidOCR

            _rapidocr_engine = RapidOCR()
        except Exception as exc:
            _rapidocr_error = str(exc).strip() or exc.__class__.__name__
    return _rapidocr_engine


def _decode_receipt_image(image_base64: str):
    from PIL import Image, ImageOps

    payload = image_base64.split(",", 1)[-1]
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(payload))))
    if image.mode != "RGB":
        image = image.convert("RGB")
    # Recognition quality drops sharply when text is under ~20px tall; upscale small photos.
    longest = max(image.size)
    if longest < 960:
        scale = 960 / longest
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    return image


def _run_ocr(image_base64: str) -> tuple[str, bool, list[str]]:
    warnings: list[str] = []
    try:
        image = _decode_receipt_image(image_base64)
    except ImportError:
        return "", False, ["Local OCR dependencies are not installed. Run pip install -r apps/api/requirements.txt."]
    except (base64.binascii.Error, OSError, ValueError):
        return "", False, ["Could not read this receipt image. Try a clearer JPG/PNG or paste receipt text."]

    text, warning = _rapidocr_text(image)
    if text is not None:
        if not text:
            warnings.append("No readable text was found on this receipt. Try a sharper, well-lit photo.")
        return text, True, warnings
    if warning:
        warnings.append(warning)

    text, warning = _tesseract_text(image)
    if text is not None:
        return text, True, warnings
    if warning:
        warnings.append(warning)
    return "", False, warnings


def _rapidocr_text(image) -> tuple[str | None, str | None]:
    engine = _get_rapidocr()
    if engine is None:
        return None, f"RapidOCR is unavailable: {_rapidocr_error}"
    try:
        import numpy as np

        result, _ = engine(np.array(image))
    except Exception as exc:
        return None, f"RapidOCR failed on this image: {str(exc).strip() or exc.__class__.__name__}"
    return _boxes_to_lines(result or []), None


def _boxes_to_lines(result: list) -> str:
    """Rebuild reading order from OCR boxes: group fragments that share a baseline into one line."""
    entries = []
    for box, text, score in result:
        text = str(text).strip()
        if not text or float(score) < 0.5:
            continue
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        entries.append(((min(ys) + max(ys)) / 2, max(ys) - min(ys), min(xs), text))
    if not entries:
        return ""

    entries.sort(key=lambda entry: (entry[0], entry[2]))
    heights = sorted(entry[1] for entry in entries)
    median_height = heights[len(heights) // 2] or 1

    lines: list[list[tuple[float, str]]] = []
    line_y = None
    for y_center, _, x_left, text in entries:
        if line_y is None or y_center - line_y > median_height * 0.6:
            lines.append([])
        lines[-1].append((x_left, text))
        line_y = y_center
    return "\n".join(" ".join(text for _, text in sorted(line)) for line in lines)


def _tesseract_text(image) -> tuple[str | None, str | None]:
    try:
        import pytesseract
    except ImportError:
        return None, None

    try:
        tesseract_cmd = os.getenv("TESSERACT_CMD", "").strip()
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        pytesseract.get_tesseract_version()
        return pytesseract.image_to_string(image).strip(), None
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        return None, f"Tesseract fallback is unavailable: {message}"


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
