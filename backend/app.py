import copy
import datetime
import os
import re
import secrets
import threading
import warnings
from typing import Optional
import jwt
import requests
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request

load_dotenv()

try:
    from . import org_store
    from .admin import admin_url_prefix, bp as admin_bp
except ImportError:  # run as a script: python3 app.py
    import org_store
    from admin import admin_url_prefix, bp as admin_bp

app = Flask(__name__)
# Admin lives at a secret path from .env; unset -> not registered at all (404).
if admin_url_prefix():
    app.register_blueprint(admin_bp, url_prefix=admin_url_prefix())

# from . import sheet_sync    # noqa: E402 — imported after app so sheet_sync can reference it
# from . import ppmc_routes   # noqa: E402 — frontend-URL bulk flow + disable endpoint
# from . import ppmc_embed    # noqa: E402 — prebuilt embed bulk flow
# app.register_blueprint(ppmc_routes.bp)
# app.register_blueprint(ppmc_embed.bp)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

warnings.filterwarnings("ignore", category=Warning, module="urllib3")


VIDEOSDK_API = "https://api.videosdk.live"
VIDEOSDK_AI  = "https://api.videosdk.live/ai/v1"

# CORS allow-list = ALLOWED_ORIGINS + FRONTEND_ORIGIN (comma-separated, .env)
# + every org's frontendOrigins (admin page, picked up without a restart).
# "*" in either env var — or nothing configured anywhere — allows any origin.
_ENV_ORIGINS = {
    org_store.normalize_origin(o)
    for key in ("ALLOWED_ORIGINS", "FRONTEND_ORIGIN")
    for o in os.environ.get(key, "").split(",")
    if o.strip()
}


# ---------------------------------------------------------------------------
# Organisation resolution
# ---------------------------------------------------------------------------
# Every client build sends its org id (X-Org-Id header, or orgId in the body /
# query string). All tokens and VideoSDK calls for that request are made with
# that org's API key + secret from orgs.json. No org id -> "default" (.env).

def request_org_id() -> str:
    body = request.get_json(silent=True) or {}
    return (
        request.headers.get("X-Org-Id")
        or (body.get("orgId") if isinstance(body, dict) else None)
        or request.args.get("orgId")
        or ""
    ).strip().lower()


def resolve_org():
    """Return (org, None) or (None, error_response)."""
    org_id = request_org_id()
    try:
        return org_store.get_org(org_id), None
    except org_store.OrgNotFound:
        app.logger.warning("unknown org %r", org_id or org_store.DEFAULT_ORG_ID)
        return None, (jsonify({"message": "Unknown organisation"}), 404)


def get_webhook_url(org: dict) -> Optional[str]:
    """Org webhook (or the .env one), tagged with the org id so the webhook
    handler knows whose credentials to use for follow-up VideoSDK calls."""
    url = org.get("webhookUrl") or os.environ.get("VIDEOSDK_WEBHOOK_URL") or ""
    if not url:
        return None
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}orgId={org['id']}"




# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

def _cors_origin() -> str:
    """Resolve the Access-Control-Allow-Origin value for the current request.

    Echo back the request's Origin only when it is in the allow-list —
    echoing the whole list would be an invalid header.
    """
    if "*" in _ENV_ORIGINS:
        return "*"
    allowed = _ENV_ORIGINS | org_store.all_frontend_origins()
    if not allowed:
        return "*"
    origin = request.headers.get("Origin", "")
    return origin if org_store.normalize_origin(origin) in allowed else ""


# after_request runs on every response — including Flask's own 404s — so
# OPTIONS preflights to any path always get the headers the browser needs.
@app.after_request
def handle_cors(response: Response) -> Response:
    if request.blueprint == "admin":
        return response  # same-origin admin page; never expose it cross-origin
    allow_origin = _cors_origin()
    if allow_origin:
        response.headers["Access-Control-Allow-Origin"] = allow_origin
        if allow_origin != "*":
            response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Participant-Role, X-Org-Id"
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



# ---------------------------------------------------------------------------
# JWT token builders
# ---------------------------------------------------------------------------

def build_crawler_token(org: dict) -> str:
    """Server-side token for VideoSDK REST and AI calls. Never sent to the client."""
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": org["apiKey"],
        "permissions": ["allow_join", "allow_mod"],
        "version": 2,
        "roles": ["crawler"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=30),
    }
    return jwt.encode(payload, org["secret"], algorithm="HS256")


def build_precall_token(org: dict) -> str:
    """
    Short-lived crawler-role token for the client's runPreCallTest() (VideoSDK 0.12.5).

    The pre-call test hits VideoSDK's V2 precall API, which rejects `rtc` tokens
    ("not allowed to access V2 api with role `rtc`"). It needs role `crawler`.
    Unlike build_crawler_token() (which is never sent to the client), this one is
    handed to the browser, so it is scoped as tightly as the API allows: join-only
    permission, no room binding, short TTL.
    """
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": org["apiKey"],
        "permissions": ["allow_join"],
        "version": 2,
        "roles": ["crawler"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=10),
    }
    return jwt.encode(payload, org["secret"], algorithm="HS256")


def build_rtc_token(org: dict, *, room_id: str, participant_id: str, role: str) -> str:
    """RTC token scoped to a specific room and participant."""
    permissions = ["allow_join", "allow_mod"] if role == "doctor" else ["allow_join"]
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": org["apiKey"],
        "permissions": permissions,
        "version": 2,
        "roomId": room_id,
        "roles": ["rtc"],
        "iat": now,
        "exp": now + datetime.timedelta(hours=1),
    }
    if participant_id:
        payload["participantId"] = participant_id
    return jwt.encode(payload, org["secret"], algorithm="HS256")


# ---------------------------------------------------------------------------
# VideoSDK REST helpers
# ---------------------------------------------------------------------------

def vsdk_post(org: dict, path: str, body: Optional[dict] = None):
    return requests.post(
        f"{VIDEOSDK_API}{path}",
        headers={"Authorization": build_crawler_token(org), "Content-Type": "application/json"},
        json=body or {},
        timeout=10,
    )


def vsdk_get(org: dict, path: str):
    return requests.get(
        f"{VIDEOSDK_API}{path}",
        headers={"Authorization": build_crawler_token(org), "Content-Type": "application/json"},
        timeout=10,
    )


def ai_post(org: dict, path: str, body: dict):
    """Proxy an AI request to VideoSDK using the server-side crawler token."""
    return requests.post(
        f"{VIDEOSDK_AI}{path}",
        headers={"Authorization": build_crawler_token(org), "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )


# ---------------------------------------------------------------------------
# Routes — /api/v1/video
# ---------------------------------------------------------------------------

def build_room_config(org: dict) -> dict:
    """POST /v2/rooms body for this org: its roomConfig (e.g. auto-recording
    with post transcription) plus the webhook wiring."""
    room_config = copy.deepcopy(org.get("roomConfig") or {})
    webhook_url = get_webhook_url(org)
    if webhook_url:
        room_config.setdefault("webhook", {
            "endPoint": webhook_url,
            "events": ["recording-*", "participant-*", "session-*", "transcription-*"],
        })
        # Auto-started recordings report recording-* / transcription-* events
        # to their own webhookUrl.
        recording = (room_config.get("autoStartConfig") or {}).get("recording")
        if isinstance(recording, dict):
            recording.setdefault("webhookUrl", webhook_url)
    return room_config


@app.route("/api/v1/video/meetings", methods=["POST"])
def create_meeting():
    err = require_doctor()
    if err:
        return err
    org, err = resolve_org()
    if err:
        return err

    room_config = build_room_config(org)

    try:
        res = vsdk_post(org, "/v2/rooms", room_config)
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
    org, err = resolve_org()
    if err:
        return err

    try:
        res = vsdk_get(org, f"/v2/rooms/validate/{clean_id}")
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
    org, err = resolve_org()
    if err:
        return err

    pid_label = "agent" if role == "doctor" else "client"
    participant_id = sanitize_id(body.get("participantId")) or f"{pid_label}-{secrets.token_hex(6)}"
    token = build_rtc_token(org, room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token}), 200


@app.route("/api/v1/video/precall-token", methods=["POST", "GET"])
def precall_token():
    """Crawler-role token for the client pre-call network test (runPreCallTest)."""
    org, err = resolve_org()
    if err:
        return err
    return jsonify({"token": build_precall_token(org)}), 200


@app.route("/api/v1/video/session", methods=["POST"])
def session_credentials():
    """
    Returns a token and participantId for a given meetingId + role (token-on-open).

    Doctor links are opened from multiple tabs and shared with a supervising agent,
    so each doctor join gets a UNIQUE participantId — otherwise same-id joins kick
    each other. The patient is a single participant, so its id stays deterministic
    (preserves identity across re-joins).
    """
    body = request.get_json(silent=True) or {}
    role = "doctor" if str(body.get("role", "")).upper() == "DOCTOR" else "patient"

    room_id = sanitize_id(body.get("meetingId"))
    if not room_id:
        return jsonify({"message": "meetingId is required"}), 400
    org, err = resolve_org()
    if err:
        return err

    if role == "doctor":
        participant_id = f"agent-{room_id}-{secrets.token_hex(4)}"[:64]
    else:
        participant_id = f"client-{room_id}"[:64]
    token = build_rtc_token(org, room_id=room_id, participant_id=participant_id, role=role)
    return jsonify({"token": token, "participantId": participant_id}), 200


# ---------------------------------------------------------------------------
# Routes — /api/v1/identity
# ---------------------------------------------------------------------------

@app.route("/api/v1/identity/ocr", methods=["POST"])
def identity_ocr():
    body = request.get_json(silent=True) or {}
    org, err = resolve_org()
    if err:
        return err
    try:
        res = ai_post(org, "/ocr", body)
    except requests.RequestException as exc:
        app.logger.error("AI /ocr unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


@app.route("/api/v1/identity/face-verify", methods=["POST"])
def identity_face_verify():
    body = request.get_json(silent=True) or {}
    org, err = resolve_org()
    if err:
        return err
    try:
        res = ai_post(org, "/face-verification/verify", body)
    except requests.RequestException as exc:
        app.logger.error("AI /face-verification/verify unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


@app.route("/api/v1/identity/liveness", methods=["POST"])
def identity_liveness():
    body = request.get_json(silent=True) or {}
    org, err = resolve_org()
    if err:
        return err
    try:
        res = ai_post(org, "/face-verification/detect-spoof", body)
    except requests.RequestException as exc:
        app.logger.error("AI /face-verification/detect-spoof unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


@app.route("/api/v1/identity/body-type", methods=["POST"])
def identity_body_type():
    body = request.get_json(silent=True) or {}
    org, err = resolve_org()
    if err:
        return err
    # The AI endpoints are split between "img" and "image" keys; send both.
    image = body.get("img") or body.get("image")
    payload = {"image": image, "img": image}
    try:
        res = ai_post(org, "/body-type/detect", payload)
    except requests.RequestException as exc:
        app.logger.error("AI /body-type/detect unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


@app.route("/api/v1/identity/aadhaar-mask", methods=["POST"])
def identity_aadhaar_mask():
    body = request.get_json(silent=True) or {}
    org, err = resolve_org()
    if err:
        return err
    payload = {
        "image": body.get("img") or body.get("image"),
        "consent": "YES",
    }
    try:
        res = ai_post(org, "/identity/aadhaar/mask", payload)
    except requests.RequestException as exc:
        app.logger.error("AI /identity/aadhaar/mask unreachable: %s", exc)
        return jsonify({"message": "AI service unavailable"}), 502
    return jsonify(res.json()), res.status_code


# ---------------------------------------------------------------------------
# Webhooks — VideoSDK recording events
# ---------------------------------------------------------------------------

def _fetch_recording_url(org: dict, room_id: str) -> Optional[str]:
    """Return the fileUrl for the latest recording of room_id, or None."""
    try:
        res = vsdk_get(org, f"/v2/recordings?roomId={room_id}&page=1&perPage=1")
        if res.ok:
            records = res.json().get("data") or []
            if records:
                return (records[0].get("file") or {}).get("fileUrl")
    except Exception as exc:
        app.logger.warning("fetch_recording_url failed for %s: %s", room_id, exc)
    return None


def _process_webhook(org: dict, event: str, room_id: Optional[str], data: dict) -> None:
    """
    Runs the slow, network-bound webhook side effects (Google Apps Script sheet
    sync, VideoSDK recording lookups) OFF the request thread.

    These call out to script.google.com and api.videosdk.live with multi-second
    timeouts; doing them inline would pin a worker for the full timeout on every
    webhook and stall unrelated requests. Errors here only affect bookkeeping, so
    we log and move on — the webhook has already been acked with 200.
    """
    try:
        if event == "session-started":
            if room_id:
                sheet_sync.update_row(room_id, status="IN_PROGRESS")

        elif event == "session-ended":
            if room_id:
                sheet_sync.update_row(room_id, status="COMPLETED")
                file_url = _fetch_recording_url(org, room_id)
                if file_url:
                    sheet_sync.update_row(room_id, recording_url=file_url)

        elif event == "recording-stopped":
            if room_id:
                file_url = _fetch_recording_url(org, room_id)
                if file_url is None:
                    # fall back to whatever the webhook payload carries
                    file_url = (data.get("file") or {}).get("fileUrl") or data.get("fileUrl")
                sheet_sync.update_row(room_id, recording_url=file_url or "")

        elif event == "recording-failed":
            session_id = data.get("sessionId")
            if session_id:
                vsdk_post(org, "/v2/sessions/end", {"sessionId": session_id})
                app.logger.warning("recording-failed: ended session %s", session_id)
    except Exception as exc:
        app.logger.error("webhook side-effect failed for %s room=%s: %s", event, room_id, exc)


@app.route("/webhooks/videosdk", methods=["POST"])
def videosdk_webhook():
    payload = request.get_json(silent=True) or {}
    event   = payload.get("webhookType")
    data    = payload.get("data") or {}

    # VideoSDK nests meetingId/roomId inside "data"; fall back to top-level for older shapes
    room_id = data.get("meetingId") or data.get("roomId") or payload.get("roomId") or payload.get("meetingId")

    # The webhook URL carries ?orgId= (see get_webhook_url), so follow-up
    # VideoSDK calls use the credentials of the org that owns the room.
    org, err = resolve_org()
    app.logger.info("webhook %s room=%s org=%s", event, room_id, org and org["id"])
    if err:
        return jsonify({"received": True}), 200

    # Ack immediately; do the slow sheet/recording work in the background so the
    # request thread is never blocked on script.google.com / VideoSDK timeouts.
    threading.Thread(
        target=_process_webhook,
        args=(org, event, room_id, data),
        daemon=True,
    ).start()

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