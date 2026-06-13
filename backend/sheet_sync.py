"""
sheet_sync.py — writes PPMC session status and recording URLs back to the
Google Sheet by POSTing to the Apps Script doPost web app.

Used exclusively by the PPMC flow. MER flow does not call this module.

Required env vars (backend/.env):
    APPSCRIPT_WEBAPP_URL  — the /exec URL from "Deploy as web app" in Apps Script
    APPSCRIPT_SECRET      — shared secret verified by the doPost handler

If APPSCRIPT_WEBAPP_URL is not set, all calls are silently skipped so the
backend still works during local development without a sheet attached.
"""

import logging
import os

import requests

logger = logging.getLogger(__name__)

_WEBAPP_URL    = os.environ.get("APPSCRIPT_WEBAPP_URL", "")
_WEBAPP_SECRET = os.environ.get("APPSCRIPT_SECRET", "")


def _post(payload: dict) -> None:
    if not _WEBAPP_URL:
        return
    try:
        res = requests.post(_WEBAPP_URL, json={**payload, "secret": _WEBAPP_SECRET}, timeout=10)
        if not res.ok:
            logger.warning("sheet_sync: Apps Script returned %s", res.status_code)
    except requests.RequestException as exc:
        logger.warning("sheet_sync: request failed: %s", exc)


def update_row(meeting_id: str, *, status: str = None, recording_url: str = None) -> None:
    """
    Update the Status and/or Recording URL columns for the given meetingId row.
    Failures are logged — a sheet-sync failure must never crash the caller.
    """
    if not _WEBAPP_URL:
        logger.debug("sheet_sync: APPSCRIPT_WEBAPP_URL not set, skipping update for %s", meeting_id)
        return
    payload: dict = {"action": "update", "meetingId": meeting_id}
    if status is not None:
        payload["status"] = status
    if recording_url is not None:
        payload["recordingUrl"] = recording_url
    _post(payload)


def append_session_row(date: str, meeting_id: str, doctor_link: str, patient_link: str) -> None:
    """Append a new CREATED row for a freshly minted session."""
    if not _WEBAPP_URL:
        logger.debug("sheet_sync: APPSCRIPT_WEBAPP_URL not set, skipping append for %s", meeting_id)
        return
    _post({
        "action":      "append",
        "date":        date,
        "meetingId":   meeting_id,
        "doctorLink":  doctor_link,
        "patientLink": patient_link,
        "status":      "CREATED",
    })
