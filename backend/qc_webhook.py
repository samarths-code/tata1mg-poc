"""
qc_webhook.py — forwards completed PPMC recordings to the QC team's Lambda.

Called from app._process_webhook on recording-stopped:

    room_id + fileUrl
      → GET /v2/rooms/<room_id>   → customRoomId ("PPMC_<policyNo>")
      → POST to the QC Lambda     → {"payload": {"object": {...}}}

The policy number rides on the room's customRoomId, set at creation time by
ppmc_embed._create_room(). Nothing is stored on our side and the Google Sheet is
never read here, so pruning stale sheet rows cannot break this path.

Fire-and-forget: a failed send is logged and dropped, no retries. To re-send a
recording, use the Meeting ID from the sheet. The caller already runs off the
request thread, so everything here is synchronous.

A room may produce several recordings; each recording-stopped event carries its
own fileUrl and is forwarded as its own QC call under the same topic.

Required env vars (backend/.env):
    QC_WEBHOOK_URL      — the QC team's API Gateway URL

Optional:
    QC_RECORDING_TYPE   — recording_type field sent to QC (default "video")

If QC_WEBHOOK_URL is unset every send is skipped, mirroring sheet_sync's
"no config, no-op" behaviour so local dev works without QC access.
"""

import logging
import os

import requests

logger = logging.getLogger(__name__)

_VIDEOSDK_API = "https://api.videosdk.live"

# Only rooms whose customRoomId carries this prefix are PPMC sessions. Rooms made
# outside the PPMC flow have no customRoomId and are ignored, not forwarded.
TOPIC_PREFIX = "PPMC_"


def _url() -> str:
    return os.environ.get("QC_WEBHOOK_URL", "")


def _recording_type() -> str:
    return os.environ.get("QC_RECORDING_TYPE", "video")


def _resolve_topic(room_id: str):
    """
    Return the room's customRoomId ("PPMC_<policyNo>"), or None if the room is not
    a PPMC session or the lookup failed.
    """
    from .ppmc_embed import _crawler_token

    try:
        res = requests.get(
            f"{_VIDEOSDK_API}/v2/rooms/{room_id}",
            headers={"Authorization": _crawler_token()},
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.warning("qc_webhook: room fetch failed for %s: %s", room_id, exc)
        return None

    if not res.ok:
        logger.warning("qc_webhook: room fetch returned %s for %s", res.status_code, room_id)
        return None

    custom_room_id = (res.json() or {}).get("customRoomId") or ""
    if not custom_room_id.startswith(TOPIC_PREFIX):
        logger.info(
            "qc_webhook: room %s has customRoomId %r — not a PPMC session, skipping",
            room_id, custom_room_id or None,
        )
        return None
    return custom_room_id


def send(room_id: str, download_url: str) -> None:
    """
    Forward one finished recording to QC. Never raises — a QC problem must not
    affect the rest of the webhook's bookkeeping.
    """
    if not _url():
        logger.debug("qc_webhook: QC_WEBHOOK_URL not set, skipping %s", room_id)
        return
    if not room_id or not download_url:
        logger.warning("qc_webhook: refusing to send room=%r url=%r", room_id, download_url)
        return

    try:
        topic = _resolve_topic(room_id)
        if not topic:
            return

        payload = {
            "payload": {
                "object": {
                    "topic": topic,
                    "recording_files": [
                        {
                            "recording_type": _recording_type(),
                            "download_url":   download_url,
                            "meeting_id":     room_id,
                        }
                    ],
                }
            }
        }

        res = requests.post(_url(), json=payload, timeout=15)
        if res.ok:
            logger.info("qc_webhook: delivered %s (topic=%s)", room_id, topic)
        else:
            logger.error(
                "qc_webhook: QC returned %s for %s (topic=%s): %s",
                res.status_code, room_id, topic, res.text[:300],
            )
    except Exception as exc:
        logger.error("qc_webhook: send failed for %s: %s", room_id, exc)
