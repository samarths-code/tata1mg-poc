"""VideoSDK tokens and rooms, Zero Runtime agent dispatch and VideoSDK face count + Face Match,
all with the requesting org's API key and secret (orgs.json).
Token format: https://docs.videosdk.live/api-reference/realtime-communication/intro"""
import base64
import logging
import time

import jwt
import requests

from .. import config
from ..config import Settings

logger = logging.getLogger(__name__)

TOKEN_EXPIRES_IN_SECONDS = 120 * 60


class VideoSDKError(Exception):
    pass


def generate_token(cfg: Settings, roles: list, room_id: str = None) -> str:
    """roles: "crawler" for the v2 REST APIs, "rtc" for joining a room.
    room_id limits the token to one room."""
    now = int(time.time())
    payload = {
        "apikey": cfg.api_key,
        "permissions": ["allow_join"],
        "version": 2,
        "roles": roles,
        "iat": now,
        "exp": now + TOKEN_EXPIRES_IN_SECONDS,
    }
    if room_id:
        payload["roomId"] = room_id
    return jwt.encode(payload, cfg.secret, algorithm="HS256")


def generate_join_token(cfg: Settings, room_id: str) -> str:
    return generate_token(cfg, roles=["rtc"], room_id=room_id)


def _json(response: requests.Response) -> dict:
    try:
        data = response.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _post(cfg: Settings, url: str, body: dict = None, timeout: int = 10) -> requests.Response:
    try:
        return requests.post(
            url,
            headers={"Authorization": generate_token(cfg, roles=["crawler"]), "Content-Type": "application/json"},
            json=body or {},
            timeout=timeout,
        )
    except requests.RequestException as error:
        raise VideoSDKError(f"Couldn't reach {url.split('/')[2]}: {error}") from error


def create_room(cfg: Settings) -> str:
    response = _post(cfg, f"{config.VIDEOSDK_API}/v2/rooms")
    data = _json(response)
    if not response.ok or "roomId" not in data:
        raise VideoSDKError(f"Room creation failed ({response.status_code}): {response.text[:200]}")
    return data["roomId"]


def dispatch_agent(cfg: Settings, room_id: str, metadata: dict) -> dict:
    """Sends the Zero Runtime agent into a room, authorised with a VideoSDK token
    (https://docs.zeroruntime.ai/agent-builder/agent/variables)."""
    if not cfg.zeroruntime_agent_id:
        raise VideoSDKError(f"Org '{cfg.org_id}': set ZERORUNTIME_AGENT_ID on the admin page.")
    response = _post(
        cfg,
        f"{config.ZERORUNTIME_API}/v2/agent/dispatch",
        {"meetingId": room_id, "agentId": cfg.zeroruntime_agent_id, "metadata": metadata},
    )
    data = _json(response)
    if not response.ok:
        raise VideoSDKError(
            f"Agent dispatch failed ({response.status_code}): {data.get('message') or response.text[:200]}"
        )
    return data


def _data_uri(image_bytes: bytes, path_hint: str = ".jpg") -> str:
    mime = "image/png" if path_hint.lower().endswith(".png") else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(image_bytes).decode()}"


def count_faces(cfg: Settings, image: bytes) -> int:
    """VideoSDK face count (Enterprise plan): the camera checks and the selfie.
    https://docs.videosdk.live/javascript/guide/identity-verification/number-of-face"""
    response = _post(
        cfg,
        f"{config.VIDEOSDK_API}/ai/v1/face-verification/detect-faces",
        {"img": _data_uri(image)},
        timeout=10,
    )
    data = _json(response)
    faces = data.get("number_of_faces")
    if not response.ok or not isinstance(faces, int):
        raise VideoSDKError(f"Face count failed ({response.status_code}): {response.text[:200]}")
    return faces


def face_match(cfg: Settings, reference: bytes, reference_name: str, selfie: bytes) -> dict:
    """VideoSDK Face Match (Enterprise plan): the full answer; "verified" says
    whether it's the same person."""
    response = _post(
        cfg,
        f"{config.VIDEOSDK_API}/ai/v1/face-verification/verify",
        {"img1": _data_uri(reference, reference_name), "img2": _data_uri(selfie)},
        timeout=30,
    )
    data = _json(response)
    if not response.ok or "verified" not in data:
        raise VideoSDKError(f"Face match failed ({response.status_code}): {response.text[:200]}")
    # Logged in full so a surprising "verified" can be checked against the score.
    logger.info("Face match %s vs selfie: %s", reference_name, data)
    return data
