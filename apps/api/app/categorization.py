"""Transaction categorization with a per-user learning loop.

Resolution order:
  1. Income flag                        -> "Income"
  2. Learned rules (user corrections)   -> exact merchant/keyword memory
  3. Curated keyword rules              -> high-precision merchant terms
  4. AI provider (see ai_providers.py)  -> constrained category pick
  5. "General" fallback
"""

import json
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai_providers import configured_providers, generate
from app.models import CategoryRuleModel, UserModel

CATEGORIES = [
    "Food",
    "Groceries",
    "Transport",
    "Travel",
    "Utilities",
    "Housing",
    "Subscriptions",
    "Shopping",
    "Healthcare",
    "Entertainment",
    "Education",
    "Personal Care",
    "Investments",
    "Income",
    "General",
]

# Values a client sends when it wants the server to pick the category.
AUTO_CATEGORY_VALUES = {"", "auto", "general"}

# Ordered: more specific buckets before broader ones (e.g. "amazon prime"
# should land in Subscriptions before Shopping's "amazon" matches).
KEYWORD_RULES: dict[str, list[str]] = {
    "Subscriptions": [
        "netflix", "spotify", "prime video", "amazon prime", "hotstar", "jiocinema",
        "youtube premium", "icloud", "google one", "chatgpt", "claude", "subscription",
        "membership", "sonyliv", "zee5",
    ],
    "Groceries": [
        "grocery", "groceries", "dmart", "bigbasket", "blinkit", "zepto", "instamart",
        "jiomart", "supermarket", "kirana", "vegetable", "fruits", "milk", "ration",
    ],
    "Food": [
        "restaurant", "cafe", "coffee", "swiggy", "zomato", "eatsure", "dominos",
        "pizza", "burger", "kfc", "mcdonald", "starbucks", "chai", "dhaba", "biryani",
        "lunch", "dinner", "breakfast", "snack", "meal", "food", "bakery", "icecream",
        "ice cream", "juice", "tiffin", "canteen", "mess ",
    ],
    "Travel": [
        "flight", "indigo", "air india", "vistara", "spicejet", "akasa", "makemytrip",
        "goibibo", "ixigo", "cleartrip", "irctc", "hotel", "oyo", "airbnb", "booking.com",
        "resort", "visa fee", "travel", "trip to", "vacation", "holiday",
    ],
    "Transport": [
        "petrol", "diesel", "fuel", "uber", "ola", "rapido", "taxi", "cab", "metro",
        "bus ", "local train", "auto rickshaw", "rickshaw", "parking", "toll", "fastag",
        "bike service", "car service", "car wash",
    ],
    "Utilities": [
        "electricity", "water bill", "gas bill", "lpg", "cylinder", "internet",
        "wifi", "broadband", "jio", "airtel", "bsnl", "recharge", "mobile bill",
        "postpaid", "prepaid", "dth", "tata play", "bill payment",
    ],
    "Housing": [
        "rent", "maintenance", "society", "landlord", "home loan", "house emi",
        "property tax", "plumber", "electrician", "repair", "furniture",
    ],
    "Healthcare": [
        "pharmacy", "apollo", "medplus", "1mg", "pharmeasy", "netmeds", "practo",
        "hospital", "clinic", "doctor", "medicine", "dental", "lab test", "diagnostic",
        "health insurance", "vaccin",
    ],
    "Entertainment": [
        "movie", "pvr", "inox", "bookmyshow", "cinema", "concert", "gaming", "steam",
        "playstation", "xbox", "event ticket", "amusement", "club ",
    ],
    "Education": [
        "course", "udemy", "coursera", "tuition", "school fee", "college fee",
        "exam fee", "books", "stationery", "coaching", "workshop",
    ],
    "Personal Care": [
        "salon", "spa", "haircut", "barber", "gym", "fitness", "cult.fit", "cosmetic",
        "skincare", "grooming",
    ],
    "Investments": [
        "mutual fund", "sip ", "zerodha", "groww", "upstox", "kuvera", "stocks",
        "shares", "gold purchase", "fixed deposit", "nps", "ppf", "crypto",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "snapdeal", "mall",
        "store", "clothes", "clothing", "shoes", "footwear", "electronics", "gadget",
        "fashion", "gift", "shopping",
    ],
    "Income": [
        "salary", "stipend", "refund", "cashback", "interest credit", "dividend",
        "freelance payment", "bonus",
    ],
}

CATEGORIZE_PROMPT = (
    "You categorize personal finance transactions for a user in India. "
    "Given a transaction description and merchant, reply with strict JSON only, shape: "
    '{"category": string, "confidence": number}. '
    f"Category must be exactly one of: {', '.join(CATEGORIES)}. "
    "Confidence is between 0 and 1. Do not include markdown.\n"
)

# Merchant values that carry no signal worth memorising as a learned rule.
_GENERIC_MERCHANTS = {"", "manual", "receipt", "income", "general", "unknown", "misc", "na", "n/a"}
_STOPWORDS = {"the", "for", "and", "with", "from", "paid", "payment", "new", "quick", "entry"}


def suggest_category_keywords(text: str) -> str:
    lower = text.lower()
    for category, words in KEYWORD_RULES.items():
        if any(word in lower for word in words):
            return category
    return "General"


def categorize(
    session: Session,
    user: UserModel | None,
    description: str,
    merchant: str = "",
    is_income: bool = False,
    use_ai: bool = True,
) -> dict:
    if is_income:
        return {"category": "Income", "confidence": 0.99, "source": "rule"}

    text = f"{merchant} {description}".strip().lower()

    learned = _match_learned_rule(session, user, text)
    if learned is not None:
        return {"category": learned, "confidence": 0.95, "source": "learned"}

    keyword_category = suggest_category_keywords(text)
    if keyword_category != "General":
        return {"category": keyword_category, "confidence": 0.8, "source": "keywords"}

    if use_ai and configured_providers():
        prompt = f"{CATEGORIZE_PROMPT}Description: {description}\nMerchant: {merchant or '(none)'}"
        content, provider, _ = generate(prompt, timeout=12)
        ai_result = _normalize_ai_category(content) if content is not None else None
        if ai_result is not None:
            category, confidence = ai_result
            return {"category": category, "confidence": confidence, "source": f"ai:{provider}"}

    return {"category": "General", "confidence": 0.3, "source": "fallback"}


def learn_correction(
    session: Session,
    user: UserModel | None,
    merchant: str,
    description: str,
    category: str,
) -> None:
    """Remember a user's category choice so the same merchant maps there next time."""
    if user is None:
        return
    category = category.strip()
    if not category or category.lower() in AUTO_CATEGORY_VALUES:
        return

    keyword = _rule_keyword(merchant, description)
    if keyword is None:
        return

    existing = session.scalars(
        select(CategoryRuleModel).where(
            CategoryRuleModel.user_id == user.id,
            CategoryRuleModel.keyword == keyword,
        )
    ).first()
    if existing is not None:
        existing.category = category
        existing.updated_at = datetime.now(timezone.utc)
    else:
        session.add(CategoryRuleModel(user_id=user.id, keyword=keyword, category=category))
    session.flush()


def _match_learned_rule(session: Session, user: UserModel | None, text: str) -> str | None:
    if user is None:
        return None
    rules = session.scalars(
        select(CategoryRuleModel).where(CategoryRuleModel.user_id == user.id)
    ).all()
    # Longest keyword wins so "amazon prime" beats "amazon".
    best = max(
        (rule for rule in rules if rule.keyword in text),
        key=lambda rule: len(rule.keyword),
        default=None,
    )
    return best.category if best is not None else None


def _rule_keyword(merchant: str, description: str) -> str | None:
    merchant_key = merchant.strip().lower()
    if merchant_key not in _GENERIC_MERCHANTS and len(merchant_key) >= 3:
        return merchant_key[:120]

    words = re.findall(r"[a-z]{3,}", description.lower())
    meaningful = [word for word in words if word not in _STOPWORDS]
    if meaningful:
        return meaningful[0][:120]
    return None


def _normalize_ai_category(content: str) -> tuple[str, float] | None:
    match = re.search(r"\{.*\}", content, flags=re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except (json.JSONDecodeError, ValueError):
        return None

    raw = str(data.get("category") or "").strip().lower()
    category = next((item for item in CATEGORIES if item.lower() == raw), None)
    if category is None:
        return None
    try:
        confidence = float(data.get("confidence") or 0.7)
    except (TypeError, ValueError):
        confidence = 0.7
    return category, max(0.4, min(confidence, 0.95))
