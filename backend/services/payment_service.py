"""
Simulated payment processing for membership upgrades.

This is NOT a real payment integration — there is no Stripe / PayPal
gateway. It validates that the request looks like a payment attempt
(non-empty card number with the right length, future expiry, 3-digit
CVV) and returns a synthetic transaction id.

The goal is to demonstrate the flow: form -> validation -> upgrade.
For a real deployment this module is the single place to swap in a
real PSP without touching the route or membership code.
"""

import re
import uuid
from datetime import datetime, timezone


PREMIUM_PRICE = 9.99
PREMIUM_CURRENCY = "AUD"


def _digits(value):
    return re.sub(r"\D", "", str(value or ""))


def validate_payment(payload):
    """Validate a fake payment payload.

    Returns (ok, message). Doesn't actually charge anything.

    Accepted shape:
      {
        "card_number": "4242424242424242",
        "expiry": "12/29",           # MM/YY
        "cvv": "123",
        "name_on_card": "Jane Doe",
        "billing_email": "jane@example.com"
      }
    """
    if not isinstance(payload, dict):
        return False, "Payment details are missing."

    card_number = _digits(payload.get("card_number"))
    if not (13 <= len(card_number) <= 19):
        return False, "Card number must be between 13 and 19 digits."

    cvv = _digits(payload.get("cvv"))
    if not (3 <= len(cvv) <= 4):
        return False, "CVV must be 3 or 4 digits."

    expiry = (payload.get("expiry") or "").strip()
    match = re.match(r"^(\d{1,2})\s*/\s*(\d{2,4})$", expiry)
    if not match:
        return False, "Expiry must be in MM/YY format."

    month = int(match.group(1))
    year_raw = match.group(2)
    year = int(year_raw) + 2000 if len(year_raw) == 2 else int(year_raw)
    if not (1 <= month <= 12):
        return False, "Expiry month must be between 1 and 12."

    now = datetime.now(timezone.utc)
    if (year, month) < (now.year, now.month):
        return False, "Card has expired."

    if not (payload.get("name_on_card") or "").strip():
        return False, "Name on card is required."

    return True, "OK"


def simulate_charge(amount=PREMIUM_PRICE, currency=PREMIUM_CURRENCY):
    """Generate a synthetic transaction id. Always succeeds when called
    after validate_payment has returned ok."""
    return {
        "transaction_id": f"sim_{uuid.uuid4().hex[:16]}",
        "amount": amount,
        "currency": currency,
        "status": "succeeded",
    }
