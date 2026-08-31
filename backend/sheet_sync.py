"""
sheet_sync.py — pushes status and recording URL updates to the Google Sheet
by POSTing to the Apps Script doPost web app.

Required env vars (backend/.env):
    APPSCRIPT_WEBAPP_URL  — /exec URL from Apps Script "Deploy as web app"
    APPSCRIPT_SECRET      — shared secret verified by the doPost handler

If APPSCRIPT_WEBAPP_URL is not set, calls are silently skipped (safe for local dev).
"""

import logging
import os
import threading
import time

import requests

logger = logging.getLogger(__name__)

_WEBAPP_URL    = os.environ.get("APPSCRIPT_WEBAPP_URL", "")
_WEBAPP_SECRET = os.environ.get("APPSCRIPT_SECRET", "")

# after-5PM override list (sheet column W = ACTIVE), cached so post-cutoff join
# attempts are bounded to at most one Apps Script call per TTL window.
_ACTIVE_TTL_SECONDS = 30
_active_lock  = threading.Lock()
_active_cache = {"ids": frozenset(), "at": 0.0}


def list_active_meeting_ids() -> frozenset:
    """meetingIds whose after-5PM switch (column W dropdown) is ACTIVE.

    The sheet is the source of truth; this cache is only a rate limiter. Fails
    closed: on any error the last fetched list (initially empty) is returned,
    so an unreachable sheet means expired links stay expired.
    """
    if not _WEBAPP_URL:
        return frozenset()

    with _active_lock:
        if time.monotonic() - _active_cache["at"] < _ACTIVE_TTL_SECONDS:
            return _active_cache["ids"]

    try:
        res = requests.post(
            _WEBAPP_URL,
            json={"secret": _WEBAPP_SECRET, "action": "listActive"},
            timeout=(3, 8),
        )
        if res.ok:
            ids = frozenset(
                str(m).strip() for m in res.json().get("meetingIds", []) if str(m).strip()
            )
            with _active_lock:
                _active_cache["ids"] = ids
                _active_cache["at"]  = time.monotonic()
            return ids
        logger.warning("sheet_sync: listActive returned %s: %s", res.status_code, res.text)
    except (requests.RequestException, ValueError) as exc:
        logger.warning("sheet_sync: listActive failed: %s", exc)
    return _active_cache["ids"]


def update_row(meeting_id: str, *, status: str = None, recording_url: str = None) -> None:
    if not _WEBAPP_URL:
        logger.warning("sheet_sync: APPSCRIPT_WEBAPP_URL not set — skipping update for %s", meeting_id)
        return

    payload = {"secret": _WEBAPP_SECRET, "meetingId": meeting_id}
    if status is not None:
        payload["status"] = status
    if recording_url is not None:
        payload["recordingUrl"] = recording_url

    try:
        res = requests.post(_WEBAPP_URL, json=payload, timeout=(3, 5))
        if res.ok:
            logger.info("sheet_sync: updated %s → %s", meeting_id, payload)
        else:
            logger.warning("sheet_sync: Apps Script returned %s for %s: %s", res.status_code, meeting_id, res.text)
    except requests.RequestException as exc:
        logger.warning("sheet_sync: request failed for %s: %s", meeting_id, exc)


def append_session_row(date: str, meeting_id: str, doctor_link: str, patient_link: str) -> None:
    if not _WEBAPP_URL:
        return
    try:
        requests.post(_WEBAPP_URL, json={
            "secret":      _WEBAPP_SECRET,
            "action":      "append",
            "date":        date,
            "meetingId":   meeting_id,
            "doctorLink":  doctor_link,
            "patientLink": patient_link,
            "status":      "CREATED",
        }, timeout=10)
    except requests.RequestException as exc:
        logger.warning("sheet_sync: append failed for %s: %s", meeting_id, exc)
