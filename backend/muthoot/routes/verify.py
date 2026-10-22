"""Verification: the live camera checks and the M2-6 selfie."""
from flask import jsonify

from ..services import selfie
from ..services.face import count_faces, decode_image
from . import bp, org_settings
from .validation import field, json_body


@bp.route("/verify/face", methods=["POST"])
def verify_face():
    image = field(json_body(), "image", str)  # base64 frame from the customer's camera
    return jsonify({"faces": count_faces(decode_image(image))})


@bp.route("/verify/selfie", methods=["POST"])
def verify_selfie():
    """The customer page posts the captured selfie; the agent reads the result below."""
    body = json_body()
    room_id = field(body, "room_id", str)
    capture_id = int(field(body, "capture_id", int))  # the agent's attempt number
    image = decode_image(field(body, "image", str))  # base64 from captureImage()
    return jsonify(selfie.check_selfie(org_settings(room_id), room_id, capture_id, image))


@bp.route("/verify/selfie/<room_id>/<int:capture_id>", methods=["GET"])
def selfie_result(room_id, capture_id):
    return jsonify(selfie.selfie_result(org_settings(room_id), room_id, capture_id))
