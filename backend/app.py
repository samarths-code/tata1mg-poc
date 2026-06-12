import datetime
import os
import re
import secrets
import warnings
from typing import Optional
import jwt
import requests
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request

load_dotenv()

app = Flask(__name__)

import sheet_sync  # noqa: E402 — imported after app so sheet_sync can reference it

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

warnings.filterwarnings("ignore", category=Warning, module="urllib3")


VIDEOSDK_API = "https://api.videosdk.live"
VIDEOSDK_AI  = "https://api.videosdk.live/ai/v1"

ALLOWED_ORIGINS = "*"


def get_api_key() -> str:
    key = os.environ.get("VIDEOSDK_API_KEY", "")
    if not key:
        raise RuntimeError("VIDEOSDK_API_KEY is not set")
    return key


def get_secret() -> str:
    secret = os.environ.get("VIDEOSDK_SECRET", "")
    if not secret:
        raise RuntimeError("VIDEOSDK_SECRET is not set")
    return secret


def get_webhook_url() -> Optional[str]:
    return os.environ.get("VIDEOSDK_WEBHOOK_URL") or None


def get_ppmc_key() -> str:
    return os.environ.get("PPMC_SHARED_KEY", "")


def get_ppmc_frontend_base_url() -> str:
    return os.environ.get("PPMC_FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

# after_request runs on every response — including Flask's own 404s — so
# OPTIONS preflights to any path always get the headers the browser needs.
@app.after_request
def handle_cors(response: Response) -> Response:
    response.headers["Access-Control-Allow-Origin"]  = ALLOWED_ORIGINS
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Participant-Role"
    if request.method == "OPTIONS":
        response.headers["Access-Control-Max-Age"] = "86400"
        response.status_code = 204
        response.data = b""
    return response


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

SAFE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


def sanitize_id(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    return value if SAFE_ID_PATTERN.match(value) else None


# ---------------------------------------------------------------------------
# Role resolution
# ---------------------------------------------------------------------------

def resolve_role() -> str:
    header = request.headers.get("X-Participant-Role", "").strip().upper()
    body   = (request.get_json(silent=True) or {}).get("role", "")
    raw    = header or str(body).strip().upper() or "CUSTOMER"
    return "DOCTOR" if raw == "DOCTOR" else "CUSTOMER"


def require_doctor():
    if resolve_role() != "DOCTOR":
        return jsonify({"message": "Doctor access required"}), 403
    return None


def require_ppmc_key():
    """Guard for PPMC bulk endpoints — checked against PPMC_SHARED_KEY env var."""
    expected = get_ppmc_key()
    if not expected:
        return jsonify({"message": "PPMC_SHARED_KEY not configured on server"}), 500
    provided = request.headers.get("X-PPMC-Key", "")
    if not secrets.compare_digest(provided, expected):
        return jsonify({"message": "Unauthorized"}), 401
    return None


# ---------------------------------------------------------------------------
# JWT token builders
# ---------------------------------------------------------------------------

def build_crawler_token() -> str:
    """Server-side token for VideoSDK REST and AI calls. Never sent to the client."""
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": get_api_key(),
        "permissions": ["allow_join", "allow_mod"],
        "version": 2,
        "roles": ["crawler"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=30),
    }
    return jwt.encode(payload, get_secret(), algorithm="HS256")


def build_rtc_token(
    *,
    room_id: str,
    participant_id: str,
    role: str,
    permissions: Optional[list] = None,
    expires_at: Optional[datetime.datetime] = None,
) -> str:
    """RTC token scoped to a specific room and participant.

    permissions: explicit list overrides the role-based default.
    expires_at:  explicit expiry overrides the default 30-minute window.
    """
    if permissions is None:
        permissions = ["allow_join", "allow_mod"] if role == "doctor" else ["allow_join"]
    now = datetime.datetime.utcnow()
    exp = expires_at if expires_at is not None else now + datetime.timedelta(minutes=30)
    payload = {
        "apikey": get_api_key(),
        "permissions": permissions,
        "version": 2,
        "roomId": room_id,
        "roles": ["rtc"],
        "iat": now,
        "exp": exp,
    }
    if participant_id:
        payload["participantId"] = participant_id
    return jwt.encode(payload, get_secret(), algorithm="HS256")


# ---------------------------------------------------------------------------
# VideoSDK REST helpers
# ---------------------------------------------------------------------------

def vsdk_post(path: str, body: Optional[dict] = None):
    return requests.post(
        f"{VIDEOSDK_API}{path}",
        headers={"Authorization": build_crawler_token(), "Content-Type": "application/json"},
        json=body or {},
        timeout=10,
    )


def vsdk_get(path: str):
    return requests.get(
        f"{VIDEOSDK_API}{path}",
        headers={"Authorization": build_crawler_token(), "Content-Type": "application/json"},
        timeout=10,
    )


def ai_post(path: str, body: dict):
    """Proxy an AI request to VideoSDK using the server-side crawler token."""
    return requests.post(
        f"{VIDEOSDK_AI}{path}",
        headers={"Authorization": build_crawler_token(), "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )


# ---------------------------------------------------------------------------
# Routes — /api/v1/video
# ---------------------------------------------------------------------------

@app.route("/api/v1/video/meetings", methods=["POST"])
def create_meeting():
    err = require_doctor()
    if err:
        return err

    webhook_url = get_webhook_url()

    room_config: dict = {
        "autoStartConfig": {
            "recording": {
                "enabled": True,
                "webhookUrl": webhook_url,
                "events": [
                    "recording-*",
                    "session-*",
                ],
                "onFailure": {
                    "waitTime": 60, #if recording fails to start after 60, close the room
                    "action": "close-room"
                }
            }
        }
    }

    # Remove webhookUrl from config if not set — VideoSDK rejects null/empty values
    if not webhook_url:
        room_config["autoStartConfig"]["recording"].pop("webhookUrl")

    try:
        res = vsdk_post("/v2/rooms", room_config)
    except requests.RequestException as exc:
        app.logger.error("VideoSDK unreachable: %s", exc)
        return jsonify({"message": "Unable to reach VideoSDK"}), 502

    if not res.ok:
        app.logger.error("VideoSDK /v2/rooms %s: %s", res.status_code, res.text)
        return jsonify({"message": "Failed to create room"}), 502

    meeting_id = res.json().get("roomId")
    if not meeting_id:
        return jsonify({"message": "Unexpected response from VideoSDK"}), 502

    return jsonify({"roomId": meeting_id}), 200


@app.route("/api/v1/video/meetings/<room_id>/validate", methods=["POST"])
def validate_meeting(room_id):
    clean_id = sanitize_id(room_id)
    if not clean_id:
        return jsonify({"valid": False}), 400

    try:
        res = vsdk_get(f"/v2/rooms/validate/{clean_id}")
    except requests.RequestException:
        return jsonify({"valid": False}), 200

    if not res.ok:
        return jsonify({"valid": False}), 200

    return jsonify({"valid": res.json().get("roomId") == clean_id}), 200


@app.route("/api/v1/video/token", methods=["POST"])
def get_token():
    body = request.get_json(silent=True) or {}
    role = "doctor" if str(body.get("role", "")).upper() == "DOCTOR" else "patient"

    room_id = sanitize_id(body.get("roomId"))
    if not room_id:
        return jsonify({"message": "roomId is required"}), 400

    participant_id = sanitize_id(body.get("participantId")) or f"{role}-{secrets.token_hex(6)}"
    token = build_rtc_token(room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token}), 200


@app.route("/api/v1/video/session", methods=["POST"])
def session_credentials():
    """
    Returns a token and a deterministic participantId for a given meetingId + role.
    Deterministic IDs preserve the same identity across re-joins.
    """
    body = request.get_json(silent=True) or {}
    role = "doctor" if str(body.get("role", "")).upper() == "DOCTOR" else "patient"

    room_id = sanitize_id(body.get("meetingId"))
    if not room_id:
        return jsonify({"message": "meetingId is required"}), 400

    participant_id = f"{role}-{room_id}"[:64]
    token = build_rtc_token(room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token, "participantId": participant_id}), 200


# ---------------------------------------------------------------------------
# Routes — /api/v1/identity
# ---------------------------------------------------------------------------

@app.route("/api/v1/identity/ocr", methods=["POST"])
def identity_ocr():
    body = request.get_json(silent=True) or {}
    try:
        res = ai_post("/ocr", body)
    except requests.RequestException as exc:
        app.logger.error("AI /ocr unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


@app.route("/api/v1/identity/face-verify", methods=["POST"])
def identity_face_verify():
    body = request.get_json(silent=True) or {}
    try:
        res = ai_post("/face-verification/verify", body)
    except requests.RequestException as exc:
        app.logger.error("AI /face-verification/verify unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


@app.route("/api/v1/identity/liveness", methods=["POST"])
def identity_liveness():
    body = request.get_json(silent=True) or {}
    try:
        res = ai_post("/face-verification/detect-spoof", body)
    except requests.RequestException as exc:
        app.logger.error("AI /face-verification/detect-spoof unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


@app.route("/api/v1/identity/aadhaar-mask", methods=["POST"])
def identity_aadhaar_mask():
    body = request.get_json(silent=True) or {}
    payload = {
        "image": body.get("img") or body.get("image"),
        "consent": "YES",
    }
    try:
        res = ai_post("/identity/aadhaar/mask", payload)
    except requests.RequestException as exc:
        app.logger.error("AI /identity/aadhaar/mask unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


# ---------------------------------------------------------------------------
# Routes — /api/v1/ppmc  (PPMC-exclusive; do NOT share with MER flow)
#
# PPMC tokens differ from MER tokens in two critical ways:
#   1. Expiry  — end-of-date + 6h grace (links are created days ahead of sessions)
#   2. Patient permission — "ask_join" instead of "allow_join"; doctor must admit them
#
# The existing MER endpoints (/api/v1/video/session, /api/v1/video/token) are
# intentionally left untouched — they still mint 30-min allow_join tokens.
# ---------------------------------------------------------------------------

MAX_BULK_SESSIONS = 50


def _ppmc_token_expiry(session_date_str: str) -> datetime.datetime:
    """Return UTC expiry = 23:59 IST on session_date + 6h grace = 00:29 UTC next day."""
    try:
        d = datetime.datetime.strptime(session_date_str, "%Y-%m-%d")
    except ValueError:
        d = datetime.datetime.utcnow()
    # 23:59 IST = 18:29 UTC; add 6h grace → 00:29 UTC next calendar day
    return datetime.datetime(d.year, d.month, d.day, 18, 29, 0) + datetime.timedelta(hours=6)


@app.route("/api/v1/ppmc/sessions/bulk", methods=["POST"])
def ppmc_bulk_sessions():
    """
    PPMC only — create N VideoSDK rooms and return pre-minted doctor + patient links.
    Called by the Apps Script custom menu; never called by the frontend.

    Auth: X-PPMC-Key header (PPMC_SHARED_KEY env var)
    Body: { "date": "YYYY-MM-DD", "count": N }
    """
    err = require_ppmc_key()
    if err:
        return err

    body = request.get_json(silent=True) or {}
    session_date = str(body.get("date", "")).strip()
    if not session_date:
        return jsonify({"message": "date is required (YYYY-MM-DD)"}), 400

    try:
        count = int(body.get("count", 0))
    except (TypeError, ValueError):
        return jsonify({"message": "count must be an integer"}), 400

    if count < 1 or count > MAX_BULK_SESSIONS:
        return jsonify({"message": f"count must be between 1 and {MAX_BULK_SESSIONS}"}), 400

    webhook_url = get_webhook_url()
    if not webhook_url:
        return jsonify({"message": "VIDEOSDK_WEBHOOK_URL must be configured for PPMC"}), 500

    expires_at = _ppmc_token_expiry(session_date)
    base_url   = get_ppmc_frontend_base_url()
    sessions   = []

    for _ in range(count):
        try:
            res = vsdk_post("/v2/rooms", {
                "webhook": {
                    "endPoint": webhook_url,
                    "events": [
                        "participant-joined",
                        "participant-left",
                        "session-started",
                        "recording-*",
                    ],
                }
            })
        except requests.RequestException as exc:
            app.logger.error("VideoSDK unreachable during PPMC bulk: %s", exc)
            return jsonify({"message": "Unable to reach VideoSDK"}), 502

        if not res.ok:
            app.logger.error("VideoSDK /v2/rooms %s: %s", res.status_code, res.text)
            return jsonify({"message": "Failed to create room"}), 502

        room_id = res.json().get("roomId")
        if not room_id:
            return jsonify({"message": "Unexpected response from VideoSDK"}), 502

        # Deterministic participant IDs — role is derived from the prefix in webhooks
        doctor_pid  = f"doctor-{room_id}"[:64]
        patient_pid = f"patient-{room_id}"[:64]

        # PPMC doctor token — allow_join + allow_mod, long expiry
        doctor_token = build_rtc_token(
            room_id=room_id,
            participant_id=doctor_pid,
            role="doctor",
            permissions=["allow_join", "allow_mod"],
            expires_at=expires_at,
        )

        # PPMC patient token — ask_join only; doctor must admit them
        patient_token = build_rtc_token(
            room_id=room_id,
            participant_id=patient_pid,
            role="patient",
            permissions=["ask_join"],
            expires_at=expires_at,
        )

        doctor_link  = (
            f"{base_url}/?meetingId={room_id}&mode=DOCTOR&flow=ppmc"
            f"&token={doctor_token}&participantId={doctor_pid}"
        )
        patient_link = (
            f"{base_url}/?meetingId={room_id}&mode=PATIENT&flow=ppmc"
            f"&token={patient_token}&participantId={patient_pid}"
        )

        sessions.append({
            "meetingId":   room_id,
            "doctorLink":  doctor_link,
            "patientLink": patient_link,
        })

    return jsonify(sessions), 200


@app.route("/api/v1/video/meetings/<room_id>/disable", methods=["POST"])
def disable_meeting(room_id):
    """
    PPMC only — permanently deactivates a VideoSDK room so both links stop working.
    Requires doctor role. Updates the Google Sheet row to DISABLED via sheet_sync.
    """
    err = require_doctor()
    if err:
        return err

    clean_id = sanitize_id(room_id)
    if not clean_id:
        return jsonify({"message": "Invalid room ID"}), 400

    try:
        res = vsdk_post("/v2/rooms/deactivate", {"roomId": clean_id})
    except requests.RequestException as exc:
        app.logger.error("VideoSDK unreachable on disable: %s", exc)
        return jsonify({"message": "Unable to reach VideoSDK"}), 502

    if not res.ok:
        app.logger.error("VideoSDK deactivate %s: %s", res.status_code, res.text)
        return jsonify({"message": "Failed to deactivate room"}), 502

    sheet_sync.update_row(clean_id, status="DISABLED")

    return jsonify({"disabled": True, "roomId": clean_id}), 200


# ---------------------------------------------------------------------------
# Webhooks — VideoSDK recording events
# ---------------------------------------------------------------------------

def _get_active_participant_ids(room_id: str) -> set:
    """Return the set of participantIds currently in the active session for room_id."""
    try:
        res = vsdk_get(f"/v2/sessions?roomId={room_id}&page=1&perPage=1")
        if not res.ok:
            return set()
        data = res.json()
        sessions = data.get("data") or []
        if not sessions:
            return set()
        # Most recent session is first; pick it
        participants = sessions[0].get("participants") or []
        return {p.get("participantId", "") for p in participants}
    except Exception as exc:
        app.logger.warning("_get_active_participant_ids(%s) failed: %s", room_id, exc)
        return set()


def _has_role(participant_ids: set, role_prefix: str) -> bool:
    return any(pid.startswith(role_prefix) for pid in participant_ids)


@app.route("/webhooks/videosdk", methods=["POST"])
def videosdk_webhook():
    payload = request.get_json(silent=True) or {}
    event   = payload.get("webhookType")
    data    = payload.get("data") or {}

    app.logger.info("webhook: %s", event)

    # ------------------------------------------------------------------
    # PPMC — auto-recording orchestration
    # Both checks are stateless: we re-fetch the live session each time
    # so the logic survives Flask restarts and any join order.
    # ------------------------------------------------------------------

    if event == "participant-joined":
        room_id = data.get("roomId") or data.get("meetingId")
        if room_id:
            pids = _get_active_participant_ids(room_id)
            if _has_role(pids, "doctor-") and _has_role(pids, "patient-"):
                try:
                    res = vsdk_post("/v2/recordings/start", {"roomId": room_id})
                    # 400 "already recording" is fine — treat as success
                    if res.ok or res.status_code == 400:
                        app.logger.info("recording started for room %s", room_id)
                    else:
                        app.logger.error("recording start failed %s: %s", res.status_code, res.text)
                except Exception as exc:
                    app.logger.error("recording start exception for %s: %s", room_id, exc)

    elif event == "participant-left":
        room_id = data.get("roomId") or data.get("meetingId")
        if room_id:
            pids = _get_active_participant_ids(room_id)
            if not _has_role(pids, "doctor-") and not _has_role(pids, "patient-"):
                try:
                    res = vsdk_post("/v2/recordings/stop", {"roomId": room_id})
                    if res.ok:
                        app.logger.info("recording stopped for room %s", room_id)
                    else:
                        app.logger.warning("recording stop %s: %s", res.status_code, res.text)
                except Exception as exc:
                    app.logger.error("recording stop exception for %s: %s", room_id, exc)

    elif event == "session-started":
        room_id = data.get("roomId") or data.get("meetingId")
        if room_id:
            sheet_sync.update_row(room_id, status="IN_SESSION")

    elif event == "recording-started":
        pass  # no action needed

    elif event == "recording-stopped":
        room_id   = data.get("roomId") or data.get("meetingId")
        file_url  = data.get("fileUrl") or data.get("file", {}).get("fileUrl")
        if room_id:
            sheet_sync.update_row(room_id, status="COMPLETED", recording_url=file_url or "")
        # TODO (Phase 2): fetch recording, upload to 1mg storage, delete from VideoSDK

    elif event == "recording-failed":
        session_id = data.get("sessionId")
        if session_id:
            try:
                vsdk_post("/v2/sessions/end", {"sessionId": session_id})
                app.logger.warning("recording-failed: ended session %s", session_id)
            except Exception as exc:
                app.logger.error("recording-failed: could not end session %s: %s", session_id, exc)

    return jsonify({"received": True}), 200


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=debug, reloader_type="watchdog")
