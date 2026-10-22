"""Journey events of every Video PD: appended at once to
data/<org>/journey_events.jsonl, and copied to the org's Events tab in batches
every FLUSH_SECONDS, so a PD costs a few Sheets writes instead of one per event (60/min)."""
import json
import logging
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from ..config import Settings, settings_for
from ..errors import ApiError
from . import sheet

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
EVENTS_FILE_NAME = "journey_events.jsonl"
FLUSH_SECONDS = 10
# If the sheet can't be written, keep at most this many rows waiting per org (the jsonl has all).
MAX_PENDING = 2000

COLUMNS = [
    "Time (IST)",
    "Seconds into PD",  # since the room's first event (the link being opened)
    "Room ID",
    "Customer ID",
    "Source",
    "Event",
    "Step",
    "State",
    "Details",
]

_lock = threading.Lock()
_first_at: dict[str, float] = {}  # room_id -> its first event's time ("Seconds into PD")
_pending: dict[str, list[dict]] = {}  # org id -> sheet rows not written yet


def record(cfg: Settings, event: dict) -> None:
    """{room_id, customer_id, source, event, step, state, details, at}"""
    event = {**event, "at": event.get("at") or time.time()}
    events_file = cfg.data_dir / EVENTS_FILE_NAME
    with _lock:
        first_at = _first_at.setdefault(event["room_id"], event["at"])
        pending = _pending.setdefault(cfg.org_id, [])
        pending.append(_sheet_row(event, first_at))
        del pending[:-MAX_PENDING]
        events_file.parent.mkdir(parents=True, exist_ok=True)
        with events_file.open("a", encoding="utf-8") as file:
            file.write(json.dumps(event, ensure_ascii=False) + "\n")


def _sheet_row(event: dict, first_at: float) -> dict:
    return {
        "Time (IST)": datetime.fromtimestamp(event["at"], IST).strftime("%Y-%m-%d %H:%M:%S"),
        "Seconds into PD": round(event["at"] - first_at, 1),
        "Room ID": event["room_id"],
        "Customer ID": event.get("customer_id") or "",
        "Source": event.get("source") or "",
        "Event": event.get("event") or "",
        "Step": event.get("step") or "",
        "State": event.get("state") or "",
        "Details": json.dumps(event.get("details") or {}, ensure_ascii=False),
    }


def flush_to_sheet() -> None:
    """Writes each org's waiting rows to its Events tab, one call per org."""
    with _lock:
        batches = {org_id: rows for org_id, rows in _pending.items() if rows}
        _pending.clear()
    for org_id, rows in batches.items():
        try:
            sheet.append_rows(settings_for(org_id), sheet.EVENTS_TAB, COLUMNS, rows)
        except (sheet.SheetError, ApiError) as error:
            detail = error.detail if isinstance(error, ApiError) else error
            logger.error("Journey events of %s not written to the sheet yet (%s); will retry.", org_id, detail)
            with _lock:
                pending = _pending.setdefault(org_id, [])
                pending[:0] = rows  # back in front, in order
                del pending[:-MAX_PENDING]
