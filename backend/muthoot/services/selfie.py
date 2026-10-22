"""M2-6 selfie check: face count, then VideoSDK Face Match against the customer's
reference photo. The customer page posts the selfie; the agent polls the result."""
from .. import config
from ..errors import ApiError
from .face import count_faces
from .reference_photo import PhotoError, load_reference_photo
from .sessions import get_session
from .videosdk import VideoSDKError, face_match

SELFIE_DIR = config.DATA_DIR / "selfies"


def check_selfie(room_id: str, capture_id: int, image: bytes) -> dict:
    session = get_session(room_id)
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
    return result


def selfie_result(room_id: str, capture_id: int) -> dict:
    result = (get_session(room_id) or {}).get("selfie", {}).get(capture_id)
    if result is None:
        raise ApiError(404, "Selfie not received yet.")
    return result
