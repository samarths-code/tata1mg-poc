"""
ppmc_routes.py — PPMC routes using the custom React frontend (PPMC_FRONTEND_BASE_URL).
Registered in app.py via: app.register_blueprint(ppmc_routes.bp)

Routes
  POST /api/v1/ppmc/sessions/bulk          — bulk-create frontend links (Apps Script → backend)
  POST /api/v1/video/meetings/<id>/disable  — permanently deactivate a room (doctor frontend)

Links are of the form:
  {PPMC_FRONTEND_BASE_URL}/?meetingId=<id>&mode=DOCTOR|PATIENT&flow=ppmc&token=<jwt>&participantId=<pid>

Patient token uses ask_join so the doctor must admit them via the AdmitDialog in the
PPMC React frontend. This is the flow for the custom frontend (ppmc-flow branch).
For prebuilt embed links use ppmc_embed.py instead.
"""

import datetime
import os
import re
import secrets
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import jwt
import requests
from flask import Blueprint, jsonify, request

from . import sheet_sync

bp = Blueprint("ppmc_routes", __name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_VIDEOSDK_API = "https://api.videosdk.live"
_MAX_BULK     = 50
_SAFE_ID      = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

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


def _sanitize_id(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    return value if _SAFE_ID.match(value) else None


def _require_ppmc_key():
    expected = os.environ.get("PPMC_SHARED_KEY", "")
    if not expected:
        return jsonify({"message": "PPMC_SHARED_KEY not configured on server"}), 500
    if not secrets.compare_digest(request.headers.get("X-PPMC-Key", ""), expected):
        return jsonify({"message": "Unauthorized"}), 401
    return None


def _require_doctor():
    role = request.headers.get("X-Participant-Role", "").strip().upper()
    if not role:
        body = request.get_json(silent=True) or {}
        role = str(body.get("role", "")).strip().upper()
    if role != "DOCTOR":
        return jsonify({"message": "Doctor access required"}), 403
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


def _vsdk_get(path: str):
    return requests.get(
        f"{_VIDEOSDK_API}{path}",
        headers={"Authorization": _crawler_token(), "Content-Type": "application/json"},
        timeout=10,
    )


def _create_room() -> str:
    webhook_url = os.environ.get("VIDEOSDK_WEBHOOK_URL", "")
    if not webhook_url:
        raise RuntimeError("VIDEOSDK_WEBHOOK_URL must be configured for PPMC")
    res = _vsdk_post("/v2/rooms", {
        "webhook": {
            "endPoint": webhook_url,
            "events":   ["participant-joined", "participant-left", "session-started", "recording-*"],
        }
    })
    if not res.ok:
        raise RuntimeError(f"VideoSDK /v2/rooms {res.status_code}: {res.text}")
    room_id = res.json().get("roomId")
    if not room_id:
        raise RuntimeError("Unexpected response from VideoSDK: missing roomId")
    return room_id

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@bp.route("/api/v1/ppmc/sessions/bulk", methods=["POST"])
def ppmc_bulk_sessions():
    """
    Create VideoSDK rooms for each patient row and return pre-minted custom-frontend links.
    Called by the Apps Script "Generate links" menu — never by the frontend directly.

    Auth: X-PPMC-Key header (PPMC_SHARED_KEY env var)
    Body: {
      "sessions": [
        {"patientName": "Alka", "doctorName": "Dr. Kumar"},
        ...
      ]
    }
    Returns: [{"meetingId": "...", "doctorLink": "...", "patientLink": "..."}, ...]

    patientName is embedded as meetingTitle in the doctor link (doctor sees patient name).
    doctorName  is embedded as meetingTitle in the patient link (patient sees doctor name).
    Patient token uses ask_join — doctor must admit via AdmitDialog in React frontend.
    """
    err = _require_ppmc_key()
    if err:
        return err

    body     = request.get_json(silent=True) or {}
    sessions_input = body.get("sessions")

    if not isinstance(sessions_input, list) or len(sessions_input) == 0:
        return jsonify({"message": "sessions must be a non-empty array"}), 400
    if len(sessions_input) > _MAX_BULK:
        return jsonify({"message": f"sessions cannot exceed {_MAX_BULK} at a time"}), 400

    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=30)
    base_url   = os.environ.get("PPMC_FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    results    = []

    for entry in sessions_input:
        patient_name = str(entry.get("patientName") or "").strip() or "Client"
        doctor_name  = str(entry.get("doctorName")  or "").strip() or "Agent"

        try:
            room_id = _create_room()
        except RuntimeError as exc:
            return jsonify({"message": str(exc)}), 502

        doctor_pid  = f"agent-{room_id}"[:64]
        patient_pid = f"client-{room_id}"[:64]

        doctor_token  = _rtc_token(room_id, doctor_pid,  ["allow_join", "allow_mod"], expires_at)
        patient_token = _rtc_token(room_id, patient_pid, ["ask_join"],                expires_at)

        from urllib.parse import quote
        doctor_link = (
            f"{base_url}/?meetingId={room_id}&mode=DOCTOR&flow=ppmc"
            f"&token={doctor_token}&participantId={doctor_pid}"
            f"&meetingTitle={quote(patient_name)}"
        )
        patient_link = (
            f"{base_url}/?meetingId={room_id}&mode=PATIENT&flow=ppmc"
            f"&token={patient_token}&participantId={patient_pid}"
            f"&meetingTitle={quote(doctor_name)}"
        )

        results.append({
            "meetingId":   room_id,
            "doctorLink":  doctor_link,
            "patientLink": patient_link,
        })

    return jsonify(results), 200


@bp.route("/api/v1/ppmc/recordings", methods=["POST"])
def fetch_recording():
    """
    Fetch the latest recording for a room from VideoSDK.
    Called by the Apps Script "Fetch Recording…" menu item.

    Auth: X-PPMC-Key header
    Body: {"meetingId": "<room_id>"}
    Returns: {"recordingId": "...", "fileUrl": "...", "found": true}
             {"found": false} when no recording exists yet.

    Also writes the fileUrl back to the sheet via sheet_sync so the row
    is updated even if the Apps Script fails to do it itself.
    """
    err = _require_ppmc_key()
    if err:
        return err

    body = request.get_json(silent=True) or {}
    room_id = body.get("meetingId", "")
    clean_id = _sanitize_id(room_id)
    if not clean_id:
        return jsonify({"message": "meetingId is required and must be a valid room ID"}), 400

    try:
        res = _vsdk_get(f"/v2/recordings?roomId={clean_id}&page=1&perPage=1")
        print("RES", res)
    except requests.RequestException as exc:
        return jsonify({"message": f"Unable to reach VideoSDK: {exc}"}), 502

    if not res.ok:
        return jsonify({"message": "Failed to fetch recordings from VideoSDK"}), 502

    data = res.json().get("data") or []
    if not data:
        return jsonify({"found": False, "recordingId": None, "fileUrl": None}), 200

    rec          = data[0]
    recording_id = rec.get("id")
    file_url     = (rec.get("file") or {}).get("fileUrl") or rec.get("fileUrl")

    if file_url:
        sheet_sync.update_row(clean_id, recording_url=file_url)

    return jsonify({"found": True, "recordingId": recording_id, "fileUrl": file_url}), 200


@bp.route("/api/v1/ppmc/recordings/bulk", methods=["POST"])
def fetch_recordings_bulk():
    """
    Fetch recordings for multiple meeting IDs in parallel.
    Much faster than calling /api/v1/ppmc/recordings N times serially.

    Auth: X-PPMC-Key header
    Body: {"meetingIds": ["id1", "id2", ...]}
    Returns: [{"meetingId": "...", "found": true, "fileUrl": "..."}, ...]
    """
    err = _require_ppmc_key()
    if err:
        return err

    body       = request.get_json(silent=True) or {}
    meeting_ids = body.get("meetingIds", [])

    if not isinstance(meeting_ids, list) or not meeting_ids:
        return jsonify({"message": "meetingIds must be a non-empty array"}), 400
    if len(meeting_ids) > 200:
        return jsonify({"message": "meetingIds cannot exceed 200 at a time"}), 400

    clean_ids = [_sanitize_id(mid) for mid in meeting_ids]
    clean_ids = [mid for mid in clean_ids if mid]

    def _fetch_one(room_id: str) -> dict:
        try:
            res = _vsdk_get(f"/v2/recordings?roomId={room_id}&page=1&perPage=1")
            if not res.ok:
                return {"meetingId": room_id, "found": False, "fileUrl": None}
            records = res.json().get("data") or []
            if not records:
                return {"meetingId": room_id, "found": False, "fileUrl": None}
            file_url = (records[0].get("file") or {}).get("fileUrl")
            return {"meetingId": room_id, "found": bool(file_url), "fileUrl": file_url}
        except Exception as exc:
            return {"meetingId": room_id, "found": False, "fileUrl": None, "error": str(exc)}

    results = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(_fetch_one, mid): mid for mid in clean_ids}
        for future in as_completed(futures):
            results.append(future.result())

    return jsonify(results), 200


@bp.route("/api/v1/video/meetings/<room_id>/disable", methods=["POST"])
def disable_meeting(room_id):
    """
    Permanently deactivates a VideoSDK room so both links stop working.
    Requires X-Participant-Role: DOCTOR. Updates the sheet row to DISABLED.
    """
    err = _require_doctor()
    if err:
        return err

    clean_id = _sanitize_id(room_id)
    if not clean_id:
        return jsonify({"message": "Invalid room ID"}), 400

    try:
        res = _vsdk_post("/v2/rooms/deactivate", {"roomId": clean_id})
    except requests.RequestException as exc:
        return jsonify({"message": f"Unable to reach VideoSDK: {exc}"}), 502

    if not res.ok:
        return jsonify({"message": "Failed to deactivate room"}), 502

    sheet_sync.update_row(clean_id, status="DISABLED")

    return jsonify({"disabled": True, "roomId": clean_id}), 200
