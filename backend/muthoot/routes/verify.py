"""Verification: the live camera checks and the M2-6 selfie."""
import base64
import binascii
import logging

from flask import jsonify

from ..errors import ApiError
from ..services import selfie
from ..services.videosdk import VideoSDKError, count_faces
from . import bp, org_settings
from .validation import field, json_body

logger = logging.getLogger(__name__)


def decode_image(data: str) -> bytes:
    """Base64 image, with or without a "data:image/...;base64," prefix."""
    if data.startswith("data:"):
        data = data.split(",", 1)[1]
    try:
        return base64.b64decode(data, validate=True)
    except binascii.Error:
        raise ApiError(400, "image must be a base64 image.")


@bp.route("/verify/face", methods=["POST"])
def verify_face():
    image = field(json_body(), "image", str)  # base64 frame from the customer's camera
    try:
        return jsonify({"faces": count_faces(org_settings(), decode_image(image))})
    except VideoSDKError as error:
        logger.warning("Camera check: %s", error)
        raise ApiError(502, "Couldn't check the camera right now.")


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
