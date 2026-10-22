"""
muthoot/routes.py — Muthoot Finance AI Video PD (Module 2), ported from its FastAPI
backend. Registered in app.py via: app.register_blueprint(muthoot.bp)

Every route is under /api/v1/muthoot and uses the "muthoot" org's VideoSDK
credentials (MUTHOOT_ORG_ID, orgs.json). The customer page and the Zero Runtime
agent call them with their backend address set to <backend>/api/v1/muthoot.

Routes
  GET  /api/v1/muthoot/demo/customers                       — start page: the LOS customers
  POST /api/v1/muthoot/demo/customers/<id>/link             — new PD link for one, emailed
  POST /api/v1/muthoot/sessions/from-link                   — customer opened the link: room + token
  POST /api/v1/muthoot/sessions/<room_id>/consents          — 4 consents saved, agent sent in
  POST /api/v1/muthoot/verify/face                          — face count (camera checks)
  POST /api/v1/muthoot/verify/selfie                        — selfie: faces + face match
  GET  /api/v1/muthoot/verify/selfie/<room_id>/<capture_id> — that check's result (agent polls)
  POST /api/v1/muthoot/results                              — agent: one row in the Results tab
  POST /api/v1/muthoot/events                               — journey event (agent + page)
  GET  /api/v1/muthoot/health

Error bodies are {"detail": ...} (as FastAPI's), which the customer page reads.
"""
import json
import logging
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request

from . import config, events
from .face import count_faces, decode_image
from .links import email_link, issue_link, link_problem, read_link_token, will_email
from .los import get_customer, load_customers
from .reference_photo import PhotoError, load_reference_photo
from .results_sheet import save_result as write_result_row
from .sheet import SheetError
from .videosdk import VideoSDKError, create_room, dispatch_agent, face_match, generate_join_token

logger = logging.getLogger(__name__)

bp = Blueprint("muthoot", __name__, url_prefix="/api/v1/muthoot")

IST = ZoneInfo("Asia/Kolkata")
SELFIE_DIR = config.DATA_DIR / "selfies"
SELFIE_RETRY_SECONDS = config.SELFIE_RETRY_MINUTES * 60
EVENT_SOURCES = ("agent", "customer_screen", "backend")

# room_id -> session. In memory: run the backend as ONE process (threads are fine),
# or a request can land on a process that doesn't know the room.
SESSIONS: dict = {}
# M2-6: customer_id -> time they may restart, after 3 failed selfies. Per customer,
# not per room, so a new link doesn't get around the wait.
RETRY_AFTER: dict = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class ApiError(Exception):
    def __init__(self, status: int, detail):
        super().__init__(detail)
        self.status = status
        self.detail = detail


@bp.errorhandler(ApiError)
def _api_error(error: ApiError):
    return jsonify({"detail": error.detail}), error.status


@bp.errorhandler(SheetError)
def _sheet_error(error: SheetError):
    logger.error("Sheet: %s", error)
    return jsonify({"detail": "We couldn't load your Video PD details. Please try again in a minute."}), 503


def _body() -> dict:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(422, "The request body must be a JSON object.")
    return body


def _field(body: dict, name: str, kind, required: bool = True):
    """body[name] if it is of `kind` (bool is not a number), else 422."""
    value = body.get(name)
    if value is None and not required:
        return None
    is_number = kind in (int, float) and isinstance(value, (int, float)) and not isinstance(value, bool)
    if not (is_number or (kind not in (int, float) and isinstance(value, kind))):
        raise ApiError(422, f"'{name}' is missing or not a {kind.__name__}.")
    return value


def _not_yet(code: str, message: str, opens_at: float) -> ApiError:
    """403 for "come back later": the customer page shows a waiting screen with a
    countdown to opens_at and retries by itself. "now" lets it allow for a wrong
    clock on the customer's device."""
    return ApiError(403, {"code": code, "message": message, "opens_at": opens_at, "now": time.time()})


def _check_not_paused(customer_id: str) -> None:
    retry_after = RETRY_AFTER.get(customer_id, 0)
    if retry_after > time.time():
        minutes = int((retry_after - time.time()) // 60) + 1
        raise _not_yet("PAUSED", f"You can restart your Video PD in {minutes} minute(s).", retry_after)


def _masked(email: str) -> str:
    """j***@videosdk.live: shows where the link goes without the full address."""
    if "@" not in email:
        return ""
    name, domain = email.split("@", 1)
    return f"{name[:1]}***@{domain}"


def _agent_customer(customer: dict) -> str:
    """The customer details the agent checks answers against, as JSON for the
    dispatch metadata. Nothing else (no email, links or photos)."""
    return json.dumps({
        "customer_id": customer["customer_id"],
        "name": customer["name"],
        "language_preference": customer["language_preference"],
        "dob": customer["dob"],
        "address": {"full": customer["address"]["full"]},
        "pan": {"name_on_card": customer["pan"]["name_on_card"]},
        "aadhaar": {"name_on_card": customer["aadhaar"]["name_on_card"]},
        "occupation": customer["occupation"],
        "residence_type": customer["residence_type"],
        "bank": customer["bank"],
        "loan_terms": customer["loan_terms"],
    }, ensure_ascii=False)


def _ist(timestamp) -> str:
    if not timestamp:
        return ""
    return datetime.fromtimestamp(timestamp, IST).strftime("%Y-%m-%d %H:%M:%S")


def _yes_no(value) -> str:
    return "" if value is None else ("Yes" if value else "No")


# ---------------------------------------------------------------------------
# Demo start page
# ---------------------------------------------------------------------------

@bp.route("/demo/customers", methods=["GET"])
def demo_customers():
    """Name, application ID, preferred language and a masked email; no LOS details."""
    return jsonify({
        "customers": [
            {
                "customer_id": customer_id,
                "name": customer["name"],
                "language_preference": customer["language_preference"],
                "email": _masked(customer.get("email", "")),
            }
            for customer_id, customer in load_customers().items()
        ]
    })


@bp.route("/demo/customers/<customer_id>/link", methods=["POST"])
def demo_link(customer_id):
    """A new link for one customer (the previous one stops working). The email is
    sent in the background, so the page doesn't wait for the mail server."""
    try:
        issued = issue_link(customer_id)
    except VideoSDKError as error:
        raise ApiError(500, str(error))
    if issued is None:
        raise ApiError(404, f"No customer {customer_id} in the LOS tab.")
    customer, link = issued
    emailing = will_email(customer)
    if emailing:
        threading.Thread(target=email_link, args=(customer_id, customer, link), daemon=True).start()
    return jsonify({"link": link, "emailed_to": _masked(customer["email"]) if emailing else None})


# ---------------------------------------------------------------------------
# Session: link -> room + token -> consents -> agent
# ---------------------------------------------------------------------------

@bp.route("/sessions/from-link", methods=["POST"])
def start_from_link():
    pd = _field(_body(), "pd", str)  # the ?pd= value from the emailed link
    try:
        token = read_link_token(pd)
    except VideoSDKError as error:
        raise ApiError(500, str(error))
    application_id, issued = token if token else (None, 0)
    customer = get_customer(application_id, fresh=True) if application_id else None
    if customer is None:
        raise ApiError(404, "This Video PD link is invalid.")
    # Only the customer's newest link works, and only until it expires.
    problem = link_problem(pd, customer["pd_link"], issued)
    if problem:
        logger.info("Link for %s refused: %s", application_id, problem)
        raise ApiError(403, problem)
    try:
        _check_not_paused(customer["customer_id"])
    except ApiError as refused:
        logger.info("Link for %s refused: %s", customer["customer_id"], refused.detail["message"])
        raise

    try:
        room_id = create_room()
        token = generate_join_token(room_id)
    except VideoSDKError as error:
        raise ApiError(502, str(error))
    SESSIONS[room_id] = {
        "customer_id": customer["customer_id"],
        # Read fresh when the link was opened; the whole PD uses this copy.
        "customer": customer,
    }
    events.record({
        "room_id": room_id, "customer_id": customer["customer_id"], "source": "backend",
        "event": "link_opened", "step": "consents",
        "details": {"language_preference": customer["language_preference"]},
    })
    return jsonify({
        "room_id": room_id,
        "customer_id": customer["customer_id"],
        "customer_name": customer["name"],
        "language_preference": customer["language_preference"],
        "loan_terms": customer["loan_terms"],  # M2-5: shown on the Loan Terms card
        "token": token,
    })


@bp.route("/sessions/<room_id>/consents", methods=["POST"])
def save_consents(room_id):
    """M2-2: the four consents (audio, video, location, AI bot), then the agent."""
    body = _body()
    audio = _field(body, "audio", bool)
    video = _field(body, "video", bool)
    ai_bot = _field(body, "ai_bot", bool)
    location = _field(body, "location", dict)
    location = {
        "latitude": float(_field(location, "latitude", float)),
        "longitude": float(_field(location, "longitude", float)),
        "accuracy": float(_field(location, "accuracy", float)),  # metres, from the browser
    }

    session = SESSIONS.get(room_id)
    if session is None:
        raise ApiError(404, "This Video PD link is invalid or has expired.")
    if not (audio and video and ai_bot):
        raise ApiError(400, "All four consents are needed to start the Video PD.")
    _check_not_paused(session["customer_id"])

    session["consents"] = {
        "audio": audio, "video": video, "location": location, "ai_bot": ai_bot,
        "given_at": int(time.time()),
    }
    events.record({
        "room_id": room_id, "customer_id": session["customer_id"], "source": "backend",
        "event": "consents_given", "step": "consents",
        "details": {"location_accuracy_m": round(location["accuracy"])},
    })

    # The customer joins right after this. The agent leaves when the customer does,
    # so a rejoin dispatches it again.
    try:
        dispatch_agent(room_id, {
            "customer_id": session["customer_id"],
            "customer": _agent_customer(session["customer"]),
        })
    except VideoSDKError as error:
        events.record({
            "room_id": room_id, "customer_id": session["customer_id"], "source": "backend",
            "event": "agent_not_started", "step": "consents", "details": {"error": str(error)},
        })
        raise ApiError(502, f"Couldn't start the Video PD agent. {error}")

    events.record({
        "room_id": room_id, "customer_id": session["customer_id"], "source": "backend",
        "event": "agent_sent_in", "step": "consents",
    })
    return jsonify({"room_id": room_id, "consents": session["consents"]})


# ---------------------------------------------------------------------------
# Verification: camera checks and the M2-6 selfie
# ---------------------------------------------------------------------------

@bp.route("/verify/face", methods=["POST"])
def verify_face():
    image = _field(_body(), "image", str)  # base64 frame from the customer's camera
    return jsonify({"faces": count_faces(decode_image(image))})


@bp.route("/verify/selfie", methods=["POST"])
def verify_selfie():
    """The customer page posts the captured selfie; the agent reads the result below."""
    body = _body()
    room_id = _field(body, "room_id", str)
    capture_id = int(_field(body, "capture_id", int))  # the agent's attempt number
    image = decode_image(_field(body, "image", str))  # base64 from captureImage()

    session = SESSIONS.get(room_id)
    customer = session.get("customer") if session else None
    if customer is None:
        raise ApiError(404, "Unknown Video PD session.")

    SELFIE_DIR.mkdir(parents=True, exist_ok=True)
    (SELFIE_DIR / f"{room_id}_{capture_id}.jpg").write_bytes(image)  # for the auditor

    faces = count_faces(image)
    result = {"capture_id": capture_id, "faces": faces, "verified": False, "reason": None, "error": None}
    if faces == 0:
        result["reason"] = "no_face"
    elif faces > 1:
        result["reason"] = "multiple_faces"
    else:
        try:
            reference, reference_name = load_reference_photo(
                customer["reference_images"]["face"], customer["customer_id"]
            )
            match = face_match(reference, reference_name, image)
            result["verified"] = bool(match["verified"])
            result["face_match_response"] = match
            if not result["verified"]:
                result["reason"] = "not_matched"
        except (PhotoError, VideoSDKError) as error:
            result["error"] = str(error)

    session.setdefault("selfie", {})[capture_id] = result
    return jsonify(result)


@bp.route("/verify/selfie/<room_id>/<int:capture_id>", methods=["GET"])
def selfie_result(room_id, capture_id):
    result = SESSIONS.get(room_id, {}).get("selfie", {}).get(capture_id)
    if result is None:
        raise ApiError(404, "Selfie not received yet.")
    return jsonify(result)


# ---------------------------------------------------------------------------
# M2-9 results and journey events
# ---------------------------------------------------------------------------

@bp.route("/results", methods=["POST"])
def save_result():
    """The agent posts the finished PD; one row goes to the Results tab. status is
    COMPLETED, IDENTITY_NOT_VERIFIED, TERMS_REJECTED, SELFIE_NOT_VERIFIED,
    SELFIE_CHECK_ERROR, CUSTOMER_INACTIVE, CUSTOMER_LEFT, BANK_NOT_VERIFIED or
    PAID_CHARGES."""
    body = _body()
    room_id = _field(body, "room_id", str)
    customer_id = _field(body, "customer_id", str)
    status = _field(body, "status", str)
    started_at = _field(body, "started_at", float, required=False)
    ended_at = float(_field(body, "ended_at", float))
    results = _field(body, "results", dict)  # the agent's per-step results

    session = SESSIONS.get(room_id, {})
    # The copy read when the link was opened; the LOS only if the session is gone.
    customer = session.get("customer") or get_customer(customer_id) or {}
    consents = session.get("consents", {})
    location = consents.get("location") or {}
    identity = results.get("identity", {})
    loan_consent = results.get("loan_consent", {})
    selfie = results.get("selfie", {})

    if status == "SELFIE_NOT_VERIFIED":
        # M2-6: set on the customer, so old and new links are both blocked.
        RETRY_AFTER[customer_id] = ended_at + SELFIE_RETRY_SECONDS

    row = {
        "Ended at (IST)": _ist(ended_at),
        "Room ID": room_id,
        "Customer ID": customer_id,
        "Customer name": customer.get("name", ""),
        "Status": status,
        "Last step": results.get("last_step", ""),
        "Last state": results.get("last_state", ""),
        "Duration (s)": round(ended_at - started_at) if started_at else "",
        "Language": results.get("language", ""),
        "Language changes": ", ".join(results.get("language_changes", [])),
        "Loan terms agreed": _yes_no(loan_consent.get("agreed")),
        "Loan consent words": loan_consent.get("said", ""),
        "Selfie attempts": selfie.get("attempts", ""),
        "Selfie faces found": selfie.get("faces", ""),
        "Selfie verified": _yes_no(selfie.get("verified")),
        "Selfie error": selfie.get("error") or "",
        "Consent: audio": _yes_no(consents.get("audio")),
        "Consent: video": _yes_no(consents.get("video")),
        "Consent: AI bot": _yes_no(consents.get("ai_bot")),
        "Location (lat, lng)": f"{location['latitude']}, {location['longitude']}" if location else "",
        "Location accuracy (m)": location.get("accuracy", ""),
        "Consents given at (IST)": _ist(consents.get("given_at")),
    }
    for detail, prefix in (
        ("name", "Name"), ("date_of_birth", "DOB"), ("address", "Address"),
        ("occupation", "Occupation"), ("residence_type", "Owned/rented"),
        ("bank_name", "Bank name"), ("account_last4", "Account last 4"),
    ):
        check = identity.get(detail, {})
        row[f"{prefix} said"] = check.get("said", "")
        row[f"{prefix} score"] = check.get("score", "")
        row[f"{prefix} verified"] = _yes_no(check.get("passed"))
        row[f"{prefix} attempts"] = check.get("attempts", "")
    bank = results.get("bank", {})
    row["Bank account confirmed"] = _yes_no(bank.get("account_confirmed"))
    charges = results.get("paid_charges", {})
    row["Paid charges to anyone"] = _yes_no(charges.get("paid"))
    row["Paid charges words"] = charges.get("said", "")

    return jsonify(write_result_row(row))


@bp.route("/events", methods=["POST"])
def add_event():
    body = _body()
    source = _field(body, "source", str)
    if source not in EVENT_SOURCES:
        raise ApiError(422, f"'source' must be one of {', '.join(EVENT_SOURCES)}.")
    event = _field(body, "event", str)  # e.g. "state_entered", "answer_checked"
    if len(event) > 64:
        raise ApiError(422, "'event' is longer than 64 characters.")
    room_id = _field(body, "room_id", str)
    data = {
        "room_id": room_id,
        # Filled in from the session when missing.
        "customer_id": body.get("customer_id") or SESSIONS.get(room_id, {}).get("customer_id"),
        "source": source,
        "event": event,
        "step": body.get("step"),
        "state": body.get("state"),
        "details": body.get("details") if isinstance(body.get("details"), dict) else {},
        "at": _field(body, "at", float, required=False),  # epoch seconds; now if missing
    }
    events.record(data)
    return jsonify({"ok": True})


@bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})
