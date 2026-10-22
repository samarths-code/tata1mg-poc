"""M2-9: one row per Video PD in the Results tab (the hand-off to the Auditor BOT).
If the sheet can't be written, the row goes to data/<org>/results_not_in_sheet.jsonl."""
import json
import logging

from ..config import Settings
from . import sheet

logger = logging.getLogger(__name__)

FALLBACK_NAME = "results_not_in_sheet.jsonl"

COLUMNS = [
    "Ended at (IST)",
    "Room ID",
    "Customer ID",
    "Customer name",
    "Status",
    "Last step", "Last state",
    "Duration (s)",
    "Language",
    "Language changes",
    "Name said", "Name score", "Name verified", "Name attempts",
    "DOB said", "DOB score", "DOB verified", "DOB attempts",
    "Address said", "Address score", "Address verified", "Address attempts",
    "Occupation said", "Occupation verified", "Occupation attempts",
    "Owned/rented said", "Owned/rented verified", "Owned/rented attempts",
    "Bank name said", "Bank name score", "Bank name verified", "Bank name attempts",
    "Account last 4 verified", "Account last 4 attempts",
    "Bank account confirmed", "Paid charges to anyone", "Paid charges words",
    "Loan terms agreed", "Loan consent words",
    "Selfie attempts", "Selfie faces found", "Selfie verified",
    "Selfie error",
    "Consent: audio", "Consent: video", "Consent: AI bot",
    "Location (lat, lng)", "Location accuracy (m)", "Consents given at (IST)",
]


def save_result(cfg: Settings, row: dict) -> dict:
    try:
        return {"saved": True, "sheet": sheet.append_rows(cfg, sheet.RESULTS_TAB, COLUMNS, [row])}
    except sheet.SheetError as error:
        fallback = cfg.data_dir / FALLBACK_NAME
        logger.error("%s. Kept in %s instead.", error, fallback)
        fallback.parent.mkdir(parents=True, exist_ok=True)
        with fallback.open("a", encoding="utf-8") as file:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")
        return {"saved": True, "file": str(fallback)}
