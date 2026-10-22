"""M2-9: the agent posts the finished PD; one row goes to the Results tab."""
from flask import jsonify

from ..services import results as results_service
from . import bp, org_settings
from .validation import field, json_body


@bp.route("/results", methods=["POST"])
def save_result():
    body = json_body()
    room_id = field(body, "room_id", str)
    return jsonify(results_service.save_result(
        org_settings(room_id),
        room_id=room_id,
        customer_id=field(body, "customer_id", str),
        status=field(body, "status", str),
        started_at=field(body, "started_at", float, required=False),
        ended_at=float(field(body, "ended_at", float)),
        results=field(body, "results", dict),  # the agent's per-step results
    ))
