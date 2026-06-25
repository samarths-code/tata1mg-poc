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

import requests

logger = logging.getLogger(__name__)

_WEBAPP_URL    = os.environ.get("APPSCRIPT_WEBAPP_URL", "")
_WEBAPP_SECRET = os.environ.get("APPSCRIPT_SECRET", "")


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
