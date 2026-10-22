"""Session: link -> room + token -> consents -> agent."""
from flask import jsonify

from ..services import sessions
from . import bp, org_settings
from .validation import field, json_body


@bp.route("/sessions/from-link", methods=["POST"])
def start_from_link():
    pd = field(json_body(), "pd", str)  # the ?pd= value from the emailed link
    return jsonify(sessions.start_from_link(org_settings(), pd))


@bp.route("/sessions/<room_id>/consents", methods=["POST"])
def save_consents(room_id):
    """M2-2: the four consents (audio, video, location, AI bot), then the agent."""
    body = json_body()
    audio = field(body, "audio", bool)
    video = field(body, "video", bool)
    ai_bot = field(body, "ai_bot", bool)
    location = field(body, "location", dict)
    location = {
        "latitude": float(field(location, "latitude", float)),
        "longitude": float(field(location, "longitude", float)),
        "accuracy": float(field(location, "accuracy", float)),  # metres, from the browser
    }
    return jsonify(sessions.save_consents(org_settings(room_id), room_id, audio, video, ai_bot, location))
