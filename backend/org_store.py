"""
Organisation registry — one JSON file holding every client's VideoSDK
credentials and meeting config.

    {
      "eureka-forbes": {
        "name": "Eureka Forbes",
        "apiKey": "...",
        "secret": "...",
        "webhookUrl": "",
        "roomConfig": { ...merged into the POST /v2/rooms body... }
      }
    }

The file holds secrets, so it is gitignored and written with 0600 permissions.
Path defaults to backend/orgs.json; override with ORGS_FILE.

Requests without an org id fall back to the "default" org built from the
VIDEOSDK_API_KEY / VIDEOSDK_SECRET env vars, so existing single-tenant
deployments keep working unchanged.
"""
import copy
import json
import os
import re
import tempfile
import threading
from typing import Optional

ORGS_FILE = os.environ.get(
    "ORGS_FILE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "orgs.json")
)
DEFAULT_ORG_ID = "default"
ORG_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
ORIGIN_PATTERN = re.compile(r"^https?://[a-z0-9.-]+(:[0-9]{1,5})?$")

_lock = threading.Lock()


class OrgNotFound(Exception):
    pass


def _read() -> dict:
    try:
        with open(ORGS_FILE, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {}
    return data if isinstance(data, dict) else {}


def _write(data: dict) -> None:
    # Atomic replace: a crash mid-write can never leave a truncated file.
    directory = os.path.dirname(ORGS_FILE) or "."
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".orgs-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
            f.write("\n")
        os.chmod(tmp, 0o600)
        os.replace(tmp, ORGS_FILE)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def _env_default_org() -> Optional[dict]:
    api_key = os.environ.get("VIDEOSDK_API_KEY", "")
    secret = os.environ.get("VIDEOSDK_SECRET", "")
    if not api_key or not secret:
        return None
    return {
        "name": "Default (.env)",
        "apiKey": api_key,
        "secret": secret,
        "webhookUrl": os.environ.get("VIDEOSDK_WEBHOOK_URL", ""),
        "roomConfig": {},
    }


def get_org(org_id: Optional[str]) -> dict:
    """Return the org's config (with "id"), or raise OrgNotFound.

    Read from disk on every call so edits made in the admin page apply to the
    next request without a restart. The file is tiny, so this is cheap.
    """
    org_id = (org_id or "").strip().lower() or DEFAULT_ORG_ID
    with _lock:
        org = _read().get(org_id)
    if org is None and org_id == DEFAULT_ORG_ID:
        org = _env_default_org()
    if not org or not org.get("apiKey") or not org.get("secret"):
        raise OrgNotFound(org_id)
    return {**copy.deepcopy(org), "id": org_id}


def normalize_origin(origin: str) -> str:
    """Browsers send "https://host[:port]" — no path, no trailing slash."""
    return origin.strip().rstrip("/").lower()


def all_frontend_origins() -> set:
    """Every org's allowed frontend origins (for CORS)."""
    with _lock:
        data = _read()
    return {
        normalize_origin(o)
        for org in data.values() if isinstance(org, dict)
        for o in (org.get("frontendOrigins") or []) if isinstance(o, str)
    }


def list_orgs() -> dict:
    with _lock:
        return copy.deepcopy(_read())


def save_org(org_id: str, org: dict) -> None:
    with _lock:
        data = _read()
        data[org_id] = org
        _write(data)
