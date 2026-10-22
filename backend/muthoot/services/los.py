"""Mock LOS (M2-1): each application's record, from the sheet's LOS tab, one row
per application_id (used as the record's "customer_id")."""
import time
from datetime import datetime

from .sheet import read_los

# Day-first, as written in India.
DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y"]

# application_id -> (read at, record). Longer than a 10-minute PD.
RECORD_CACHE_SECONDS = 15 * 60
_records: dict[str, tuple[float, dict]] = {}


def _iso_date(text: str) -> str:
    """YYYY-MM-DD, or the text unchanged if it isn't a date we can read."""
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return text


def _language(value: str) -> str:
    """The PD's language from pd_language. English (or empty) means Hinglish: the
    demo speaks Hinglish to customers who chose English."""
    value = value.strip()
    return "Hinglish" if not value or value.lower() == "english" else value


def _number(text: str) -> int | float | None:
    cleaned = text.replace(",", "").replace("₹", "").replace("%", "").strip()
    if not cleaned:
        return None
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return int(value) if value.is_integer() else value


def _record(row: dict) -> dict:
    name = row.get("name", "")
    address_parts = [row.get(key, "") for key in ("address_line1", "address_line2", "city", "state")]
    address_full = ", ".join(part for part in address_parts if part)
    if row.get("pincode"):
        address_full = f"{address_full} {row['pincode']}".strip()

    return {
        "customer_id": row["application_id"],
        "name": name,
        "language_preference": _language(row.get("pd_language", "")),
        "pd_link": row.get("pd_link", ""),
        "dob": _iso_date(row.get("dob", "")),
        "address": {"full": address_full},
        "pan": {"name_on_card": row.get("pan_name") or name},
        "aadhaar": {"name_on_card": row.get("aadhaar_name") or name},
        "loan_terms": {
            "loan_amount_inr": _number(row.get("loan_amount_inr", "")),
            "roi_percent_pa": _number(row.get("roi_percent_pa", "")),
            "emi_amount_inr": _number(row.get("emi_amount_inr", "")),
            "emi_start_date": _iso_date(row.get("emi_start_date", "")),
            "emi_count": _number(row.get("emi_count", "")),
            "processing_fee_percent": _number(row.get("processing_fee_percent", "")),
            "processing_fee_inr": _number(row.get("processing_fee_inr", "")),
            "insurance_types": [
                kind.strip() for kind in row.get("insurance_types", "").split(",") if kind.strip()
            ],
            "total_premium_funded_inr": _number(row.get("total_premium_funded_inr", "")),
            "net_disbursement_amount_inr": _number(row.get("net_disbursement_amount_inr", "")),
        },
        # A Drive link or a file name (services/reference_photo.py); empty until set.
        "reference_images": {"face": row.get("face_photo", "")},
        "occupation": row.get("occupation", ""),
        "residence_type": row.get("residence_type", ""),
        "bank": {
            "name": row.get("bank_name", ""),
            "account_number": row.get("bank_account_number", ""),
        },
        "email": row.get("email", ""),
    }


def load_customers(fresh: bool = False) -> dict[str, dict]:
    """Every application in the LOS tab, by application_id."""
    return {row["application_id"]: _record(row) for row in read_los(fresh) if row.get("application_id")}


def get_customer(customer_id: str, fresh: bool = False) -> dict | None:
    """One application's record, kept for RECORD_CACHE_SECONDS. Opening a link reads
    it fresh (fresh=True), so sheet edits count from the next PD."""
    cached = _records.get(customer_id)
    if cached and not fresh and time.time() - cached[0] < RECORD_CACHE_SECONDS:
        return cached[1]
    customer = load_customers(fresh=fresh).get(customer_id)
    if customer is not None:
        _records[customer_id] = (time.time(), customer)
    return customer
