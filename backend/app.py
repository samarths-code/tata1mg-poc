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

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

VIDEOSDK_API = "https://api.videosdk.live"

# Set FRONTEND_ORIGIN in your .env as a comma-separated list of allowed origins.
# Example: http://localhost:3001,https://your-app.vercel.app
# Using * is acceptable for local dev / ngrok tunnels but never for production.
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


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

CORS(
    app,
    origins=ALLOWED_ORIGINS,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Participant-Role"],
    supports_credentials=False,
)


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

# Only allow alphanumerics, hyphens, and underscores — keeps room/participant
# IDs safe to embed in URLs and JWT payloads.
SAFE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


def sanitize_id(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    return value if SAFE_ID_PATTERN.match(value) else None


# ---------------------------------------------------------------------------
# Role resolution
# ---------------------------------------------------------------------------

def resolve_role() -> str:
    """Return 'DOCTOR' or 'CUSTOMER' based on the request header or body."""
    body_role = (request.get_json(silent=True) or {}).get("role", "")
    raw = str(body_role).strip().upper() or "CUSTOMER"
    return "DOCTOR" if raw == "DOCTOR" else "CUSTOMER"


def require_doctor():
    """Block the request if the caller is not a doctor. Returns an error response or None."""
    if resolve_role() != "DOCTOR":
        return jsonify({"message": "Doctor access required"}), 403
    return None


# ---------------------------------------------------------------------------
# JWT token builders
# ---------------------------------------------------------------------------

def build_crawler_token() -> str:
    """
    Server-side management token used to authenticate VideoSDK REST API calls.
    This token is never exposed to the client.
    """
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


def build_ai_token() -> str:
    """
    Short-lived crawler token sent to the client so it can call VideoSDK's
    AI endpoints (OCR, face-match, anti-spoof) directly from the browser.
    Expires with the session to limit the blast radius of a leaked token.
    """
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": get_api_key(),
        "permissions": ["allow_join", "allow_mod"],
        "version": 2,
        "roles": ["crawler"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=120),
    }
    return jwt.encode(payload, get_secret(), algorithm="HS256")


def build_rtc_token(*, room_id: str, participant_id: Optional[str] = None, role: str) -> str:
    """
    RTC token scoped to a specific room and participant.
    Doctors get moderation permissions; patients get join-only.
    """
    permissions = (
        ["allow_join", "allow_mod"] if role == "doctor" else ["allow_join"]
    )
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": get_api_key(),
        "permissions": permissions,
        "version": 2,
        "roomId": room_id,
        "roles": ["rtc"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=120),
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
        headers={
            "Authorization": build_crawler_token(),
            "Content-Type": "application/json",
        },
        json=body or {},
        timeout=10,
    )


def vsdk_get(path: str):
    hell = build_crawler_token()
    print("HELL",hell)
    return requests.get(
        f"{VIDEOSDK_API}{path}",
        headers={
            "Authorization": hell,
            "Content-Type": "application/json",
        },
        timeout=10,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/video/meetings", methods=["POST"])
def create_meeting():
    err = require_doctor()
    if err:
        return err

    try:
        res = vsdk_post("/v2/rooms")
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
    clean_id = sanitize_id(room_id)
    if not clean_id:
        return jsonify({"valid": False}), 400

    try:
        res = vsdk_get(f"/v2/rooms/validate/{clean_id}")
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

    room_id = sanitize_id(body.get("roomId"))
    if not room_id:
        return jsonify({"message": "roomId is required"}), 400

    participant_id = sanitize_id(body.get("participantId")) or f"{role}-{secrets.token_hex(6)}"

    token = build_rtc_token(room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token, "aiToken": build_ai_token()}), 200


@app.route("/api/video/session-credentials", methods=["POST"])
def session_credentials():
    """
    Returns a token and a deterministic participantId for a given meetingId + role.
    Using a deterministic ID means the same identity is preserved across re-joins.
    """
    body = request.get_json(silent=True) or {}

    body_role = str(body.get("role", "")).upper()
    role = "doctor" if body_role == "DOCTOR" else "patient"

    room_id = sanitize_id(body.get("meetingId"))
    if not room_id:
        return jsonify({"message": "meetingId is required"}), 400

    participant_id = f"{role}-{room_id}"[:64]

    token = build_rtc_token(room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token, "participantId": participant_id, "aiToken": build_ai_token()}), 200


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
