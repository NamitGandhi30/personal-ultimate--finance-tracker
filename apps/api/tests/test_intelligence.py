import base64
import io

from PIL import Image, ImageDraw, ImageFont

from app.intelligence import parse_receipt_text, scan_receipt

RECEIPT_LINES = [
    ("ANAND SWEETS & SAVOURIES", 34),
    ("12 Commercial Street, Bengaluru", 22),
    ("Ph: 9876543210  GSTIN: 29ABCDE1234F1Z5", 22),
    ("Date: 11/06/2026  Time: 19:42", 22),
    ("Kaju Katli 500g          450.00", 26),
    ("Masala Mixture 250g       95.00", 26),
    ("Badam Milk x2            120.00", 26),
    ("Subtotal                 665.00", 26),
    ("CGST 2.5%                 16.63", 26),
    ("SGST 2.5%                 16.63", 26),
    ("GRAND TOTAL              698.26", 30),
]


def render_receipt_base64() -> str:
    width = 620
    height = 60 + sum(size + 16 for _, size in RECEIPT_LINES)
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    y = 30
    for text, size in RECEIPT_LINES:
        draw.text((30, y), text, fill="black", font=ImageFont.load_default(size=size))
        y += size + 16
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


def test_scan_receipt_image_extracts_total_not_phone_number() -> None:
    result = scan_receipt(image_base64=render_receipt_base64(), filename="sweets.png", use_ai_parser=False)

    assert result["ocr_available"] is True
    assert abs(result["transaction"]["amount"] - 698.26) < 0.01
    assert "anand" in result["transaction"]["merchant"].lower()
    assert result["transaction"]["is_income"] is False


def test_scan_receipt_rejects_garbage_image() -> None:
    result = scan_receipt(image_base64="not-actually-base64!!!", filename="bad.png", use_ai_parser=False)

    assert result["ocr_available"] is False
    assert result["needs_review"] is True
    assert result["warnings"]


def test_parse_receipt_text_prefers_total_keyword_over_larger_numbers() -> None:
    parsed = parse_receipt_text(
        "Cafe Azzure\nPh: 9876543210\nDate: 11/06/2026\nEspresso 180.00\nCroissant 220.00\n"
        "Subtotal 400.00\nGST 20.00\nTotal: 420.00"
    )

    assert parsed["amount"] == 420.00
    assert parsed["merchant"] == "Cafe Azzure"


def test_parse_receipt_text_ignores_phone_dates_and_handles_commas() -> None:
    parsed = parse_receipt_text("Croma Electronics\nPh 9988776655\n12/05/2026 18:30\nGrand Total Rs 1,24,999.00")

    assert parsed["amount"] == 124999.00


def test_parse_receipt_text_without_total_falls_back_to_largest_plausible() -> None:
    parsed = parse_receipt_text("Quick Mart\nMilk 64.00\nBread 45.00\nEggs 92.50")

    assert parsed["amount"] == 92.50
