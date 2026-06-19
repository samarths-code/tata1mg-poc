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
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
from urllib.parse import quote

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


_MAX_NAME_LEN = 30  # characters before URL-encoding; keeps URLs reasonable

def _safe_name(name: str, fallback: str) -> str:
    """Sanitize, truncate, and URL-encode a display name for the embed URL."""
    cleaned = (name or "").strip() or fallback
    if len(cleaned) > _MAX_NAME_LEN:
        cleaned = cleaned[:_MAX_NAME_LEN].rstrip()
    return quote(cleaned, safe="")  # encode spaces → %20, handles all special chars


def _embed_url(name: str, meeting_id: str, token: str, participant_id: str, fallback: str = "Participant") -> str:
    return (
        f"{_EMBED_BASE}?name={_safe_name(name, fallback)}&meetingId={meeting_id}"
        f"&token={token}&participantId={participant_id}&{_EMBED_FIXED}"
    )

# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@bp.route("/api/v1/ppmc/embed/bulk", methods=["POST"])
def ppmc_embed_bulk():
    """
    Create VideoSDK rooms for each patient row and return pre-minted embed links.
    Auth: X-PPMC-Key header (PPMC_SHARED_KEY env var)
    Body: {"sessions": [{"patientName": "Alka", "doctorName": "Dr. Kumar"}, ...]}
    Returns: [{"meetingId": "...", "doctorLink": "...", "patientLink": "..."}, ...]

    patientName becomes the display name on the patient embed link.
    doctorName becomes the display name on the doctor embed link.
    """
    err = _require_ppmc_key()
    if err:
        return err

    body           = request.get_json(silent=True) or {}
    sessions_input = body.get("sessions")

    if not isinstance(sessions_input, list) or len(sessions_input) == 0:
        return jsonify({"message": "sessions must be a non-empty array"}), 400
    if len(sessions_input) > _MAX_BULK:
        return jsonify({"message": f"sessions cannot exceed {_MAX_BULK} at a time"}), 400

    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=30)

    def _create_session(entry: dict):
        patient_name = str(entry.get("patientName") or "").strip() or "Patient"
        doctor_name  = str(entry.get("doctorName")  or "").strip() or "Doctor"
        room_id      = _create_room()  # raises RuntimeError on failure
        doctor_pid   = f"doctor-{room_id}"[:64]
        patient_pid  = f"patient-{room_id}"[:64]
        doctor_token  = _rtc_token(room_id, doctor_pid,  ["allow_join", "allow_mod"], expires_at)
        patient_token = _rtc_token(room_id, patient_pid, ["allow_join"],              expires_at)
        return {
            "meetingId":   room_id,
            "doctorLink":  _embed_url(doctor_name,  room_id, doctor_token,  doctor_pid,  fallback="Doctor"),
            "patientLink": _embed_url(patient_name, room_id, patient_token, patient_pid, fallback="Patient"),
        }

    results  = [None] * len(sessions_input)
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(_create_session, entry): idx
                   for idx, entry in enumerate(sessions_input)}
        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
            except RuntimeError as exc:
                return jsonify({"message": str(exc)}), 502

    return jsonify(results), 200
