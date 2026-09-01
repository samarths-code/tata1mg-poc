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

import logging
import sys

# Ensure INFO-level logs are routed to stdout so PM2 / Gunicorn capture them.
logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(asctime)s: %(levelname)s: %(message)s")

app = Flask(__name__)

from . import sheet_sync    # noqa: E402 — imported after app so sheet_sync can reference it
from . import qc_webhook    # noqa: E402 — forwards finished recordings to the QC Lambda
from . import ppmc_routes   # noqa: E402 — frontend-URL bulk flow + disable endpoint
from . import ppmc_embed    # noqa: E402 — prebuilt embed bulk flow
app.register_blueprint(ppmc_routes.bp)
app.register_blueprint(ppmc_embed.bp)

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


# Daily cutoff (IST, "HH:MM"). A link works only on the day its room was
# created, until this time; after that no token is issued unless the room still
# has an ongoing session (rejoin) or the sheet's after-5PM switch (column W
# dropdown) is ACTIVE. Empty string disables the cutoff entirely.
LINK_EXPIRY_TIME_IST = os.environ.get("LINK_EXPIRY_TIME_IST", "17:00")
LINK_EXPIRED_MESSAGE = (
    "This meeting link has expired. Please use a valid meeting link to join the meeting."
)
_IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def _cutoff_time() -> Optional[datetime.time]:
    if not LINK_EXPIRY_TIME_IST:
        return None
    try:
        hour, minute = (int(part) for part in LINK_EXPIRY_TIME_IST.split(":"))
        return datetime.time(hour, minute)
    except ValueError:
        return None


def link_expiry_at(created_at: datetime.datetime) -> Optional[datetime.datetime]:
    """The instant a link stops working: the cutoff on the IST day its room was
    created. A room created after the cutoff (e.g. an evening batch for
    tomorrow) counts as the next day's link."""
    cutoff = _cutoff_time()
    if cutoff is None:
        return None
    created_ist = created_at.astimezone(_IST)
    day = created_ist.date()
    if created_ist.time() >= cutoff:
        day += datetime.timedelta(days=1)
    return datetime.datetime.combine(day, cutoff, tzinfo=_IST)


# roomId -> createdAt. A cache only (VideoSDK is the source of truth); it just
# avoids re-fetching the room on every join. Safe to lose on restart.
_room_created_cache: dict = {}
_room_created_lock = threading.Lock()


def room_created_at(room_id: str) -> Optional[datetime.datetime]:
    with _room_created_lock:
        if room_id in _room_created_cache:
            return _room_created_cache[room_id]
    try:
        res = vsdk_get(f"/v2/rooms/{room_id}")
        if not res.ok:
            return None
        raw = str(res.json().get("createdAt") or "")
        created = datetime.datetime.strptime(raw, "%Y-%m-%dT%H:%M:%S.%fZ").replace(
            tzinfo=datetime.timezone.utc
        )
    except (requests.RequestException, ValueError):
        return None
    with _room_created_lock:
        if len(_room_created_cache) > 5000:
            _room_created_cache.clear()
        _room_created_cache[room_id] = created
    return created


def is_link_expired(room_id: str) -> bool:
    """Same-day rule: expired once the cutoff on the link's creation day has
    passed. If the creation date cannot be determined, fall back to the plain
    time-of-day rule so a VideoSDK hiccup never blocks daytime joins."""
    cutoff = _cutoff_time()
    if cutoff is None:
        return False
    now = datetime.datetime.now(_IST)
    created = room_created_at(room_id)
    if created is None:
        return now.time() >= cutoff
    return now >= link_expiry_at(created)


def has_ongoing_session(room_id: str) -> bool:
    """True when the room has a live session — lets a doctor or patient who
    dropped mid-call rejoin after the cutoff without any ops action."""
    try:
        res = vsdk_get(f"/v2/sessions/?roomId={room_id}&page=1&perPage=5")
        if not res.ok:
            return False
        return any(s.get("status") == "ongoing" for s in res.json().get("data") or [])
    except (requests.RequestException, ValueError):
        return False




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


def build_precall_token() -> str:
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
        "apikey": get_api_key(),
        "permissions": ["allow_join"],
        "version": 2,
        "roles": ["crawler"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=10),
    }
    return jwt.encode(payload, get_secret(), algorithm="HS256")


def build_rtc_token(*, room_id: str, participant_id: str, role: str) -> str:
    """RTC token scoped to a specific room and participant."""
    permissions = ["allow_join", "allow_mod"] if role == "doctor" else ["allow_join"]
    now = datetime.datetime.utcnow()
    payload = {
        "apikey": get_api_key(),
        "permissions": permissions,
        "version": 2,
        "roomId": room_id,
        "roles": ["rtc"],
        "iat": now,
        "exp": now + datetime.timedelta(hours=1),
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

    room_config: dict = {}
    if webhook_url:
        room_config["webhook"] = {
            "endPoint": webhook_url,
            "events": ["recording-*", "participant-*", "session-*"],
        }

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


@app.route("/api/v1/video/precall-token", methods=["POST", "GET"])
def precall_token():
    """Crawler-role token for the client pre-call network test (runPreCallTest)."""
    return jsonify({"token": build_precall_token()}), 200


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

    if (
        is_link_expired(room_id)
        and not has_ongoing_session(room_id)
        and room_id not in sheet_sync.list_active_meeting_ids()
    ):
        return jsonify({"code": "LINK_EXPIRED", "message": LINK_EXPIRED_MESSAGE}), 410

    if role == "doctor":
        participant_id = f"doctor-{room_id}-{secrets.token_hex(4)}"[:64]
    else:
        participant_id = f"patient-{room_id}"[:64]
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
# Webhooks — VideoSDK recording events
# ---------------------------------------------------------------------------

def _fetch_recording_url(room_id: str) -> Optional[str]:
    """Return the fileUrl for the latest recording of room_id, or None."""
    try:
        res = vsdk_get(f"/v2/recordings?roomId={room_id}&page=1&perPage=1")
        if res.ok:
            records = res.json().get("data") or []
            if records:
                return (records[0].get("file") or {}).get("fileUrl")
    except Exception as exc:
        app.logger.warning("fetch_recording_url failed for %s: %s", room_id, exc)
    return None


def _process_webhook(event: str, room_id: Optional[str], data: dict) -> None:
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
                file_url = _fetch_recording_url(room_id)
                if file_url:
                    sheet_sync.update_row(room_id, recording_url=file_url)

        elif event == "recording-stopped":
            if room_id:
                # A room can produce several recordings. This payload names the
                # file that just finished, so trust it first — _fetch_recording_url
                # asks for the room's *latest* recording, which on a second
                # recording can still be the first one if VideoSDK has not indexed
                # the new file yet.
                file_url = (data.get("file") or {}).get("fileUrl") or data.get("fileUrl")
                if not file_url:
                    file_url = _fetch_recording_url(room_id)
                
                qc_webhook.send(room_id, file_url)
                sheet_sync.update_row(room_id, recording_url=file_url or "")
       

        elif event == "recording-failed":
            session_id = data.get("sessionId")
            if session_id:
                vsdk_post("/v2/sessions/end", {"sessionId": session_id})
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

    app.logger.info("webhook %s room=%s", event, room_id)

    # Ack immediately; do the slow sheet/recording work in the background so the
    # request thread is never blocked on script.google.com / VideoSDK timeouts.
    threading.Thread(
        target=_process_webhook,
        args=(event, room_id, data),
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