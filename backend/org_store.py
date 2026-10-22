"""
Organisation registry — one JSON file holding every client's VideoSDK
credentials and meeting config.

    {
      "eureka-forbes": {
        "name": "Eureka Forbes",
        "apiKey": "...",
        "secret": "...",
        "webhookUrl": "",
        "roomConfig": { ...merged into the POST /v2/rooms body... },
        "env": { "KEY": "value", ... },     # per-org settings (admin page)
        "envSecrets": ["KEY", ...]          # which env values are masked
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
# Bare hostname (no scheme/port/path) — doubles as a directory name under
# BUILDS_ROOT, so it must never contain "/" or start with ".".
DOMAIN_PATTERN = re.compile(r"^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$")

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


# ---------------------------------------------------------------------------
# Per-org environment variables
# ---------------------------------------------------------------------------
# Each org can carry its own settings, added one at a time on the admin page:
#
#     "env":        {"GOOGLE_SHEET_ID": "...", "SMTP_PASSWORD": "..."}
#     "envSecrets": ["SMTP_PASSWORD"]      # masked on the admin page
#
# Code reads them with get_var(org, "KEY"). Feature modules (e.g. muthoot)
# register the keys they read with register_env_keys(), so the admin page can
# suggest them.

ENV_KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{0,63}$")
MAX_ENV_VALUE_CHARS = 20000  # room for a pasted service-account JSON key

# key -> {"group", "help", "secret"}; filled by register_env_keys().
KNOWN_ENV_KEYS: dict = {}


def register_env_keys(group: str, keys: dict) -> None:
    """keys: {KEY: (help text, is_secret)}."""
    for key, (help_text, secret) in keys.items():
        KNOWN_ENV_KEYS[key] = {"group": group, "help": help_text, "secret": bool(secret)}


class OrgVarError(ValueError):
    """An org variable is set but isn't of the expected type."""


def get_var(org: dict, key: str, default=None, *, cast=str, env_fallback: Optional[str] = None):
    """The common way to read an org variable.

        get_var(org, "GOOGLE_SHEET_ID")
        get_var(org, "SMTP_PORT", 587, cast=int)
        get_var(org, "SMTP_USER", env_fallback="MUTHOOT_SMTP_USER")

    Order: the org's own value, then os.environ[env_fallback] (for settings that
    used to live in .env), then `default`. Blank counts as unset. The value is
    stripped and passed through `cast` (str, int, float or bool); a value that
    doesn't fit raises OrgVarError.
    """
    value = (org.get("env") or {}).get(key)
    if (value is None or not str(value).strip()) and env_fallback:
        value = os.environ.get(env_fallback)
    if value is None or not str(value).strip():
        return default
    value = str(value).strip()
    if cast is bool:
        return value.lower() in ("1", "true", "yes", "on")
    try:
        return cast(value)
    except ValueError:
        raise OrgVarError(f"Org '{org.get('id', '?')}': {key} must be {cast.__name__} (it is '{value}')")


def request_org_id() -> str:
    """The org id a request names: X-Org-Id header, orgId in the JSON body, or
    orgId in the query string. "" when none (get_org then uses "default")."""
    from flask import request  # only needed by request handlers

    body = request.get_json(silent=True) or {}
    return (
        request.headers.get("X-Org-Id")
        or (body.get("orgId") if isinstance(body, dict) else None)
        or request.args.get("orgId")
        or ""
    ).strip().lower()


def set_env_var(org_id: str, key: str, value: str, secret: bool) -> dict:
    """Add or update one variable; returns the updated org. Raises OrgNotFound."""
    with _lock:
        data = _read()
        org = data.get(org_id)
        if not isinstance(org, dict):
            raise OrgNotFound(org_id)
        env = dict(org.get("env") or {})
        env[key] = value
        secrets = [k for k in (org.get("envSecrets") or []) if k != key and k in env]
        if secret:
            secrets.append(key)
        org["env"], org["envSecrets"] = env, sorted(secrets)
        _write(data)
        return copy.deepcopy(org)


def delete_env_var(org_id: str, key: str) -> dict:
    """Remove one variable; returns the updated org. Raises OrgNotFound."""
    with _lock:
        data = _read()
        org = data.get(org_id)
        if not isinstance(org, dict):
            raise OrgNotFound(org_id)
        env = dict(org.get("env") or {})
        env.pop(key, None)
        org["env"] = env
        org["envSecrets"] = [k for k in (org.get("envSecrets") or []) if k in env]
        _write(data)
        return copy.deepcopy(org)
