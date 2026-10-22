"""M2-6 selfie check: VideoSDK face count, then VideoSDK Face Match against the customer's
reference photo. The customer page posts the selfie; the agent polls the result."""
from ..config import Settings
from ..errors import ApiError
from .reference_photo import PhotoError, load_reference_photo
from .sessions import get_session
from .videosdk import VideoSDKError, count_faces, face_match


def check_selfie(cfg: Settings, room_id: str, capture_id: int, image: bytes) -> dict:
    session = get_session(room_id)
    customer = session.get("customer") if session and session["org_id"] == cfg.org_id else None
    if customer is None:
        raise ApiError(404, "Unknown Video PD session.")

    # The selfie is only checked here, never saved.
    result = {"capture_id": capture_id, "faces": None, "verified": False, "reason": None, "error": None}
    try:
        faces = result["faces"] = count_faces(cfg, image)
        if faces == 0:
            result["reason"] = "no_face"
        elif faces > 1:
            result["reason"] = "multiple_faces"
        else:
            reference, reference_name = load_reference_photo(
                cfg,
                customer["reference_images"]["face"], customer["customer_id"]
            )
            match = face_match(cfg, reference, reference_name, image)
            result["verified"] = bool(match["verified"])
            result["face_match_response"] = match
            if not result["verified"]:
                result["reason"] = "not_matched"
    except (PhotoError, VideoSDKError) as error:
        result["error"] = str(error)

    session.setdefault("selfie", {})[capture_id] = result
    return result


def selfie_result(cfg: Settings, room_id: str, capture_id: int) -> dict:
    session = get_session(room_id) or {}
    result = session.get("selfie", {}).get(capture_id) if session.get("org_id") == cfg.org_id else None
    if result is None:
        raise ApiError(404, "Selfie not received yet.")
    return result
