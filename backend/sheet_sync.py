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


def update_row(
    meeting_id: str,
    *,
    status: str = None,
    recording_url: str = None,
) -> None:
    """
    Update the Status and/or Recording URL columns for the given meetingId row
    in the PPMC Google Sheet.

    Failures are logged as warnings — a sheet-sync failure must never crash
    the webhook handler or the disable endpoint.
    """
    if not _WEBAPP_URL:
        logger.debug("sheet_sync: APPSCRIPT_WEBAPP_URL not set, skipping update for %s", meeting_id)
        return

    payload = {"secret": _WEBAPP_SECRET, "meetingId": meeting_id}
    if status is not None:
        payload["status"] = status
    if recording_url is not None:
        payload["recordingUrl"] = recording_url

    try:
        res = requests.post(_WEBAPP_URL, json=payload, timeout=10)
        if not res.ok:
            logger.warning("sheet_sync: Apps Script returned %s for %s", res.status_code, meeting_id)
    except requests.RequestException as exc:
        logger.warning("sheet_sync: request failed for %s: %s", meeting_id, exc)
