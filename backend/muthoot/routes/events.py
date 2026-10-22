"""Journey events from the agent and the customer page."""
from flask import jsonify

from ..errors import ApiError
from ..services import journey_events
from ..services.sessions import customer_id_of
from . import bp, org_settings
from .validation import field, json_body

EVENT_SOURCES = ("agent", "customer_screen", "backend")


@bp.route("/events", methods=["POST"])
def add_event():
    body = json_body()
    source = field(body, "source", str)
    if source not in EVENT_SOURCES:
        raise ApiError(422, f"'source' must be one of {', '.join(EVENT_SOURCES)}.")
    event = field(body, "event", str)  # e.g. "state_entered", "answer_checked"
    if len(event) > 64:
        raise ApiError(422, "'event' is longer than 64 characters.")
    room_id = field(body, "room_id", str)
    journey_events.record(org_settings(room_id), {
        "room_id": room_id,
        # Filled in from the session when missing.
        "customer_id": body.get("customer_id") or customer_id_of(room_id),
        "source": source,
        "event": event,
        "step": body.get("step"),
        "state": body.get("state"),
        "details": body.get("details") if isinstance(body.get("details"), dict) else {},
        "at": field(body, "at", float, required=False),  # epoch seconds; now if missing
    })
    return jsonify({"ok": True})
