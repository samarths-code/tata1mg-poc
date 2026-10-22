"""M2-9: turns the agent's finished PD into one Results-tab row (see results_sheet)."""
from datetime import datetime
from zoneinfo import ZoneInfo

from ..config import Settings
from . import results_sheet
from .los import get_customer
from .sessions import get_session, pause_customer

IST = ZoneInfo("Asia/Kolkata")


def _ist(timestamp) -> str:
    if not timestamp:
        return ""
    return datetime.fromtimestamp(timestamp, IST).strftime("%Y-%m-%d %H:%M:%S")


def _yes_no(value) -> str:
    return "" if value is None else ("Yes" if value else "No")


def save_result(cfg: Settings, room_id: str, customer_id: str, status: str, started_at, ended_at: float, results: dict) -> dict:
    """status is COMPLETED, IDENTITY_NOT_VERIFIED, TERMS_REJECTED, SELFIE_NOT_VERIFIED,
    SELFIE_CHECK_ERROR, CUSTOMER_INACTIVE, CUSTOMER_LEFT, BANK_NOT_VERIFIED or
    PAID_CHARGES."""
    session = get_session(room_id) or {}
    if session.get("org_id") != cfg.org_id:
        session = {}
    # The copy read when the link was opened; the LOS only if the session is gone.
    customer = session.get("customer") or get_customer(cfg, customer_id) or {}
    consents = session.get("consents", {})
    location = consents.get("location") or {}
    identity = results.get("identity", {})
    loan_consent = results.get("loan_consent", {})
    selfie = results.get("selfie", {})

    if status == "SELFIE_NOT_VERIFIED":
        pause_customer(cfg, customer_id, ended_at)

    row = {
        "Ended at (IST)": _ist(ended_at),
        "Room ID": room_id,
        "Customer ID": customer_id,
        "Customer name": customer.get("name", ""),
        "Status": status,
        "Last step": results.get("last_step", ""),
        "Last state": results.get("last_state", ""),
        "Duration (s)": round(ended_at - started_at) if started_at else "",
        "Language": results.get("language", ""),
        "Language changes": ", ".join(results.get("language_changes", [])),
        "Loan terms agreed": _yes_no(loan_consent.get("agreed")),
        "Loan consent words": loan_consent.get("said", ""),
        "Selfie attempts": selfie.get("attempts", ""),
        "Selfie faces found": selfie.get("faces", ""),
        "Selfie verified": _yes_no(selfie.get("verified")),
        "Selfie error": selfie.get("error") or "",
        "Consent: audio": _yes_no(consents.get("audio")),
        "Consent: video": _yes_no(consents.get("video")),
        "Consent: AI bot": _yes_no(consents.get("ai_bot")),
        "Location (lat, lng)": f"{location['latitude']}, {location['longitude']}" if location else "",
        "Location accuracy (m)": location.get("accuracy", ""),
        "Consents given at (IST)": _ist(consents.get("given_at")),
    }
    for detail, prefix in (
        ("name", "Name"), ("date_of_birth", "DOB"), ("address", "Address"),
        ("occupation", "Occupation"), ("residence_type", "Owned/rented"),
        ("bank_name", "Bank name"), ("account_last4", "Account last 4"),
    ):
        check = identity.get(detail, {})
        row[f"{prefix} said"] = check.get("said", "")
        row[f"{prefix} score"] = check.get("score", "")
        row[f"{prefix} verified"] = _yes_no(check.get("passed"))
        row[f"{prefix} attempts"] = check.get("attempts", "")
    bank = results.get("bank", {})
    row["Bank account confirmed"] = _yes_no(bank.get("account_confirmed"))
    charges = results.get("paid_charges", {})
    row["Paid charges to anyone"] = _yes_no(charges.get("paid"))
    row["Paid charges words"] = charges.get("said", "")

    return results_sheet.save_result(cfg, row)
