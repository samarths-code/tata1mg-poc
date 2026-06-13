"""
ppmc_embed.py — bulk session creation using VideoSDK prebuilt embed links.
Registered in app.py via: app.register_blueprint(ppmc_embed.bp)

Route
  POST /api/v1/ppmc/embed/bulk — create N rooms, return pre-minted embed URLs

Links use https://embed.videosdk.live/rtc-js-prebuilt/ — no custom frontend needed.
participantId is baked into the token (doctor-<roomId> / patient-<roomId>) so the
webhook handler in app.py can identify roles for auto-recording.

The Apps Script receives the response and appends rows to the sheet itself.
"""

import datetime
import os
import secrets
from typing import Optional

import jwt
import requests
from flask import Blueprint, jsonify, request

bp = Blueprint("ppmc_embed", __name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_VIDEOSDK_API = "https://api.videosdk.live"
_MAX_BULK     = 50

_EMBED_BASE  = "https://embed.videosdk.live/rtc-js-prebuilt/0.3.45/"
_EMBED_FIXED = (
    "recordingEnabled=true"
    "&participantCanToggleRecording=true"
    "&cameraResolution=h720p_w1280p"
    "&canChangeLayout=true"
    "&canPin=true"
    "&cameraOptimizationMode=text"
    "&participantCanEndMeeting=true"
    "&canRemoveOtherParticipant=true"
    "&mode=conference"
    "&hlsEnabled=true"
    "&participantCanToggleHls=true"
    "&toggleParticipantMode=true"
    "&webcamEnabled=false"
    "&micEnabled=false"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _api_key() -> str:
    key = os.environ.get("VIDEOSDK_API_KEY", "")
    if not key:
        raise RuntimeError("VIDEOSDK_API_KEY is not set")
    return key


def _secret() -> str:
    s = os.environ.get("VIDEOSDK_SECRET", "")
    if not s:
        raise RuntimeError("VIDEOSDK_SECRET is not set")
    return s


def _require_ppmc_key():
    expected = os.environ.get("PPMC_SHARED_KEY", "")
    if not expected:
        return jsonify({"message": "PPMC_SHARED_KEY not configured on server"}), 500
    if not secrets.compare_digest(request.headers.get("X-PPMC-Key", ""), expected):
        return jsonify({"message": "Unauthorized"}), 401
    return None


def _crawler_token() -> str:
    now = datetime.datetime.utcnow()
    return jwt.encode(
        {
            "apikey":      _api_key(),
            "permissions": ["allow_join", "allow_mod"],
            "version":     2,
            "roles":       ["crawler"],
            "iat":         now,
            "exp":         now + datetime.timedelta(minutes=30),
        },
        _secret(),
        algorithm="HS256",
    )


def _rtc_token(
    room_id: str,
    participant_id: str,
    permissions: list,
    expires_at: datetime.datetime,
) -> str:
    now = datetime.datetime.utcnow()
    return jwt.encode(
        {
            "apikey":        _api_key(),
            "permissions":   permissions,
            "version":       2,
            "roomId":        room_id,
            "participantId": participant_id,
            "roles":         ["rtc"],
            "iat":           now,
            "exp":           expires_at,
        },
        _secret(),
        algorithm="HS256",
    )


def _token_expiry(session_date_str: str) -> datetime.datetime:
    """23:59 IST on session_date + 6 h grace = 00:29 UTC next calendar day."""
    try:
        d = datetime.datetime.strptime(session_date_str, "%Y-%m-%d")
    except ValueError:
        d = datetime.datetime.utcnow()
    return datetime.datetime(d.year, d.month, d.day, 18, 29, 0) + datetime.timedelta(hours=6)


def _vsdk_post(path: str, body: Optional[dict] = None):
    return requests.post(
        f"{_VIDEOSDK_API}{path}",
        headers={"Authorization": _crawler_token(), "Content-Type": "application/json"},
        json=body or {},
        timeout=10,
    )


def _create_room() -> str:
    webhook_url = os.environ.get("VIDEOSDK_WEBHOOK_URL", "")
    room_config: dict = {
        "autoStartConfig": {
            "recording": {
                "enabled":   True,
                "onFailure": {"waitTime": 60, "action": "close-room"},
            }
        }
    }
    if webhook_url:
        # autoStartConfig webhookUrl delivers recording-* events
        room_config["autoStartConfig"]["recording"]["webhookUrl"] = webhook_url
        # top-level webhook delivers session-started / session-ended
        room_config["webhook"] = {
            "endPoint": webhook_url,
            "events":   ["session-started", "session-ended", "recording-started", "recording-stopped"],
        }
    res = _vsdk_post("/v2/rooms", room_config)
    if not res.ok:
        raise RuntimeError(f"VideoSDK /v2/rooms {res.status_code}: {res.text}")
    room_id = res.json().get("roomId")
    if not room_id:
        raise RuntimeError("Unexpected response from VideoSDK: missing roomId")
    return room_id


def _embed_url(name: str, meeting_id: str, token: str, participant_id: str) -> str:
    return (
        f"{_EMBED_BASE}?name={name}&meetingId={meeting_id}"
        f"&token={token}&participantId={participant_id}&{_EMBED_FIXED}"
    )

# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@bp.route("/api/v1/ppmc/embed/bulk", methods=["POST"])
def ppmc_embed_bulk():
    """
    Create N VideoSDK rooms and return pre-minted VideoSDK prebuilt embed links.
    Auth: X-PPMC-Key header (PPMC_SHARED_KEY env var)
    Body: {"date": "YYYY-MM-DD", "count": N}
    Returns: [{"meetingId": "...", "doctorLink": "...", "patientLink": "..."}, ...]
    """
    err = _require_ppmc_key()
    if err:
        return err

    body         = request.get_json(silent=True) or {}
    session_date = str(body.get("date", "")).strip()
    if not session_date:
        return jsonify({"message": "date is required (YYYY-MM-DD)"}), 400

    try:
        count = int(body.get("count", 0))
    except (TypeError, ValueError):
        return jsonify({"message": "count must be an integer"}), 400

    if count < 1 or count > _MAX_BULK:
        return jsonify({"message": f"count must be between 1 and {_MAX_BULK}"}), 400

    expires_at = _token_expiry(session_date)
    sessions   = []

    for _ in range(count):
        try:
            room_id = _create_room()
        except RuntimeError as exc:
            return jsonify({"message": str(exc)}), 502

        doctor_pid  = f"doctor-{room_id}"[:64]
        patient_pid = f"patient-{room_id}"[:64]

        doctor_token  = _rtc_token(room_id, doctor_pid,  ["allow_join", "allow_mod"], expires_at)
        patient_token = _rtc_token(room_id, patient_pid, ["allow_join"],              expires_at)

        sessions.append({
            "meetingId":   room_id,
            "doctorLink":  _embed_url("Doctor",  room_id, doctor_token,  doctor_pid),
            "patientLink": _embed_url("Patient", room_id, patient_token, patient_pid),
        })

    return jsonify(sessions), 200
