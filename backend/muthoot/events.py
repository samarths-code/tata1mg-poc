"""Journey events of every Video PD: appended at once to
data/journey_events.jsonl, and copied to the Events tab in batches every
FLUSH_SECONDS, so a PD costs a few Sheets writes instead of one per event (60/min)."""
import json
import logging
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from . import config, sheet

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
EVENTS_FILE = config.DATA_DIR / "journey_events.jsonl"
FLUSH_SECONDS = 10
# If the sheet can't be written, keep at most this many rows waiting (the jsonl has all).
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
_pending: list[dict] = []  # sheet rows not written yet


def record(event: dict) -> None:
    """{room_id, customer_id, source, event, step, state, details, at}"""
    event = {**event, "at": event.get("at") or time.time()}
    with _lock:
        first_at = _first_at.setdefault(event["room_id"], event["at"])
        _pending.append(_sheet_row(event, first_at))
        del _pending[:-MAX_PENDING]
        EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with EVENTS_FILE.open("a", encoding="utf-8") as file:
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
    """Writes the waiting rows to the Events tab in one call."""
    with _lock:
        rows = list(_pending)
        _pending.clear()
    if not rows:
        return
    try:
        sheet.append_rows(sheet.EVENTS_TAB, COLUMNS, rows)
    except sheet.SheetError as error:
        logger.error("Journey events not written to the sheet yet (%s); will retry.", error)
        with _lock:
            _pending[:0] = rows  # back in front, in order
            del _pending[:-MAX_PENDING]
