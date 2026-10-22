"""Video PD sessions: opening a link (room + token), saving the four consents and
sending the agent in, plus the M2-6 pause after 3 failed selfies.

Kept in memory: run the backend as ONE process (threads are fine), or a request
can land on a process that doesn't know the room."""
import json
import logging
import time

from .. import config
from ..errors import ApiError, not_yet
from . import journey_events
from .links import link_problem, read_link_token
from .los import get_customer
from .videosdk import VideoSDKError, create_room, dispatch_agent, generate_join_token

logger = logging.getLogger(__name__)

SELFIE_RETRY_SECONDS = config.SELFIE_RETRY_MINUTES * 60

# room_id -> {"customer_id", "customer", "consents", "selfie"}
SESSIONS: dict = {}
# M2-6: customer_id -> time they may restart, after 3 failed selfies. Per customer,
# not per room, so a new link doesn't get around the wait.
RETRY_AFTER: dict = {}


def get_session(room_id: str) -> dict | None:
    return SESSIONS.get(room_id)


def customer_id_of(room_id: str) -> str | None:
    return SESSIONS.get(room_id, {}).get("customer_id")


def pause_customer(customer_id: str, ended_at: float) -> None:
    """M2-6: set on the customer, so old and new links are both blocked."""
    RETRY_AFTER[customer_id] = ended_at + SELFIE_RETRY_SECONDS


def check_not_paused(customer_id: str) -> None:
    retry_after = RETRY_AFTER.get(customer_id, 0)
    if retry_after > time.time():
        minutes = int((retry_after - time.time()) // 60) + 1
        raise not_yet("PAUSED", f"You can restart your Video PD in {minutes} minute(s).", retry_after)


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


def start_from_link(pd: str) -> dict:
    """The customer opened their link (?pd=...): checks signature, newest link,
    expiry and the selfie pause, then makes a room and a join token."""
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
        check_not_paused(customer["customer_id"])
    except ApiError as refused:
        logger.info("Link for %s refused: %s", customer["customer_id"], refused.detail["message"])
        raise

    try:
        room_id = create_room()
        join_token = generate_join_token(room_id)
    except VideoSDKError as error:
        raise ApiError(502, str(error))
    SESSIONS[room_id] = {
        "customer_id": customer["customer_id"],
        # Read fresh when the link was opened; the whole PD uses this copy.
        "customer": customer,
    }
    journey_events.record({
        "room_id": room_id, "customer_id": customer["customer_id"], "source": "backend",
        "event": "link_opened", "step": "consents",
        "details": {"language_preference": customer["language_preference"]},
    })
    return {
        "room_id": room_id,
        "customer_id": customer["customer_id"],
        "customer_name": customer["name"],
        "language_preference": customer["language_preference"],
        "loan_terms": customer["loan_terms"],  # M2-5: shown on the Loan Terms card
        "token": join_token,
    }


def save_consents(room_id: str, audio: bool, video: bool, ai_bot: bool, location: dict) -> dict:
    """M2-2: the four consents (audio, video, location, AI bot), then the agent."""
    session = SESSIONS.get(room_id)
    if session is None:
        raise ApiError(404, "This Video PD link is invalid or has expired.")
    if not (audio and video and ai_bot):
        raise ApiError(400, "All four consents are needed to start the Video PD.")
    check_not_paused(session["customer_id"])

    session["consents"] = {
        "audio": audio, "video": video, "location": location, "ai_bot": ai_bot,
        "given_at": int(time.time()),
    }
    journey_events.record({
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
        journey_events.record({
            "room_id": room_id, "customer_id": session["customer_id"], "source": "backend",
            "event": "agent_not_started", "step": "consents", "details": {"error": str(error)},
        })
        raise ApiError(502, f"Couldn't start the Video PD agent. {error}")

    journey_events.record({
        "room_id": room_id, "customer_id": session["customer_id"], "source": "backend",
        "event": "agent_sent_in", "step": "consents",
    })
    return {"room_id": room_id, "consents": session["consents"]}
