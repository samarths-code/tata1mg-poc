"""
VideoSDK auth/token backend — Flask
Responsibilities: create room, validate room, issue RTC tokens.
AI calls (OCR, face-match, anti-spoof) are made directly from the client.
"""

import datetime
import os
import re
import secrets
from typing import Optional

import jwt
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

VIDEOSDK_API = "https://api.videosdk.live"

# Comma-separated list of allowed origins, e.g.:
#   FRONTEND_ORIGIN=http://localhost:3001,https://your-app.vercel.app
# Use * to allow all (dev/ngrok only — never in production).
ALLOWED_ORIGINS = (
    "*" 
)


def _api_key() -> str:
    val = os.environ.get("VIDEOSDK_API_KEY", "")
    if not val:
        raise RuntimeError("VIDEOSDK_API_KEY is not configured")
    return val


def _secret() -> str:
    val = os.environ.get("VIDEOSDK_SECRET", "")
    if not val:
        raise RuntimeError("VIDEOSDK_SECRET is not configured")
    return val


# ── CORS ──────────────────────────────────────────────────────────────────────

CORS(
    app,
    origins=ALLOWED_ORIGINS,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Participant-Role"],
    supports_credentials=False,
)


# ── Input sanitisation ────────────────────────────────────────────────────────

_SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


def _sanitize_id(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    return value if _SAFE_ID.match(value) else None


# ── Role guard ────────────────────────────────────────────────────────────────

def _resolve_role() -> str:
    header = request.headers.get("X-Participant-Role", "").strip().upper()
    body = (request.get_json(silent=True) or {}).get("role", "")
    raw = header or str(body).strip().upper() or "CUSTOMER"
    return "DOCTOR" if raw == "DOCTOR" else "CUSTOMER"


def _require_doctor():
    if _resolve_role() != "DOCTOR":
        return jsonify({"message": "Doctor access required"}), 403
    return None


# ── Token helpers ─────────────────────────────────────────────────────────────


def _crawler_token() -> str:
    """Server-side management token for VideoSDK REST calls. Never sent to the client."""
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": _api_key(),
        "permissions": ["allow_join", "allow_mod"],
        "version": 2,
        "roles": ["crawler"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=30),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def _ai_token() -> str:
    """
    Short-lived crawler token returned to the client for VideoSDK AI API calls
    (OCR, face-match, anti-spoof). Expires with the session so a leaked token
    has a limited window of misuse.
    """
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": _api_key(),
        "permissions": ["allow_join", "allow_mod"],
        "version": 2,
        "roles": ["crawler"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=120),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def _rtc_token(*, room_id: str, participant_id: str, role: str) -> str:
    permissions = (
        ["allow_join", "allow_mod"] if role == "doctor" else ["allow_join"]
    )
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": _api_key(),
        "permissions": permissions,
        "version": 2,
        "roomId": room_id,
        "roles": ["rtc"],
        "participantId": participant_id,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=120),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


# ── VideoSDK REST helpers ──────────────────────────────────────────────────────


def _vsdk_post(path: str, body: Optional[dict] = None):
    return requests.post(
        f"{VIDEOSDK_API}{path}",
        headers={
            "Authorization": _crawler_token(),
            "Content-Type": "application/json",
        },
        json=body or {},
        timeout=10,
    )


def _vsdk_get(path: str):
    return requests.get(
        f"{VIDEOSDK_API}{path}",
        headers={
            "Authorization": _crawler_token(),
            "Content-Type": "application/json",
        },
        timeout=10,
    )


# ── Routes ────────────────────────────────────────────────────────────────────


@app.route("/api/video/meetings", methods=["POST"])
def create_meeting():
    err = _require_doctor()
    if err:
        return err

    try:
        res = _vsdk_post("/v2/rooms")
    except requests.RequestException as exc:
        app.logger.error("VideoSDK unreachable: %s", exc)
        return jsonify({"message": "Unable to reach VideoSDK API"}), 502

    if not res.ok:
        app.logger.error("VideoSDK /v2/rooms %s: %s", res.status_code, res.text)
        return jsonify({"message": "Failed to create room"}), 502

    data = res.json()
    meeting_id = data.get("roomId")
    if not meeting_id:
        return jsonify({"message": "Unexpected response from VideoSDK"}), 502

    return jsonify({"roomId": meeting_id}), 200


@app.route("/api/video/meetings/<room_id>/validate", methods=["POST"])
def validate_meeting(room_id):
    clean_id = _sanitize_id(room_id)
    if not clean_id:
        return jsonify({"valid": False}), 400

    try:
        res = _vsdk_get(f"/v2/rooms/validate/{clean_id}")
    except requests.RequestException:
        return jsonify({"valid": False}), 200

    if not res.ok:
        return jsonify({"valid": False}), 200

    data = res.json()
    return jsonify({"valid": data.get("roomId") == clean_id}), 200


@app.route("/api/video/token", methods=["POST"])
def get_token():
    body = request.get_json(silent=True) or {}

    body_role = str(body.get("role", "")).upper()
    role = "doctor" if body_role == "DOCTOR" else "patient"

    room_id = _sanitize_id(body.get("roomId"))
    if not room_id:
        return jsonify({"message": "roomId is required"}), 400

    participant_id = _sanitize_id(body.get("participantId")) or f"{role}-{secrets.token_hex(6)}"

    token = _rtc_token(room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token, "aiToken": _ai_token()}), 200


@app.route("/api/video/session-credentials", methods=["POST"])
def session_credentials():
    """
    Returns { token, participantId } for a given meetingId + role.
    participantId is deterministic so the same identity is preserved on re-joins.
    """
    body = request.get_json(silent=True) or {}

    body_role = str(body.get("role", "")).upper()
    role = "doctor" if body_role == "DOCTOR" else "patient"

    room_id = _sanitize_id(body.get("meetingId"))
    if not room_id:
        return jsonify({"message": "meetingId is required"}), 400

    participant_id = f"{role}-{room_id}"[:64]

    token = _rtc_token(room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token, "participantId": participant_id, "aiToken": _ai_token()}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=debug, reloader_type="watchdog")
