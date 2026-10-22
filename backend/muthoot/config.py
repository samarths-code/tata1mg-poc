"""Muthoot Video PD settings, per org.

Each org that runs the Video PD keeps its settings as org variables on the admin
page (orgs.json -> the org's "env"), next to its VideoSDK API key and secret.
Requests pick the org from the X-Org-Id header (see routes/__init__.py).

The default org (MUTHOOT_ORG_ID, "muthoot") also falls back to the MUTHOOT_*
keys in backend/.env, so an existing setup keeps working unchanged.
"""
import os
from dataclasses import dataclass
from pathlib import Path

from .errors import ApiError

try:
    from .. import org_store
except ImportError:  # backend run as a script: python3 app.py
    import org_store

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PACKAGE_DIR.parent

VIDEOSDK_API = "https://api.videosdk.live"
ZERORUNTIME_API = "https://api.zeroruntime.ai"
MODELS_DIR = PACKAGE_DIR / "models"
LOGO_FILE = PACKAGE_DIR / "assets" / "muthoot-logo.png"

# Requests without an org id use this org.
DEFAULT_ORG_ID = os.environ.get("MUTHOOT_ORG_ID", "muthoot").strip().lower()
# Files the flow writes go in DATA_DIR/<org id>/ (events, selfies, unsent results).
_data_root = os.environ.get("MUTHOOT_DATA_DIR", "").strip()


def _path(value: str, default: Path) -> Path:
    """A relative path is read from the backend folder."""
    if not value:
        return default
    path = Path(value)
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()


DATA_ROOT = _path(_data_root, PACKAGE_DIR / "data")

# The org variables this flow reads: name -> (help on the admin page, is secret).
ORG_KEYS = {
    "ZERORUNTIME_AGENT_ID": ("the deployed Zero Runtime agent (same VideoSDK account as the org's key)", False),
    "CLIENT_URL": ("the customer page's address; PD links are built on it", False),
    "GOOGLE_SHEET_ID": ("Google Sheet with LOS / Results / Events tabs", False),
    "GOOGLE_SERVICE_ACCOUNT_JSON": ("the service account's JSON key, pasted in full", True),
    "GOOGLE_SERVICE_ACCOUNT_FILE": ("or: path of the JSON key file on the server (relative to backend/)", False),
    "GOOGLE_PHOTOS_FOLDER_ID": ("optional Drive folder of reference photos", False),
    "LINK_VALID_HOURS": ("hours a PD link works (default 24, 0 = no limit)", False),
    "SELFIE_RETRY_MINUTES": ("wait after 3 failed selfies (default 30)", False),
    "SMTP_HOST": ("mail server for the link emails (default smtp.gmail.com)", False),
    "SMTP_PORT": ("587 = STARTTLS (default), 465 = SSL", False),
    "SMTP_USER": ("mail login; empty = no emails are sent", False),
    "SMTP_PASSWORD": ("mail password (Gmail: an App Password)", True),
    "EMAIL_FROM": ("sender address (default SMTP_USER)", False),
    "EMAIL_FROM_NAME": ("sender name (default Muthoot Finance Video PD)", False),
    "PHOTOS_DIR": ("folder of local reference photos (default backend/muthoot/photos)", False),
}
org_store.register_env_keys("Muthoot Video PD", ORG_KEYS)


@dataclass(frozen=True)
class Settings:
    org_id: str
    api_key: str
    secret: str
    zeroruntime_agent_id: str
    client_url: str
    google_sheet_id: str
    google_service_account_json: str
    google_service_account_file: str
    google_photos_folder_id: str
    link_valid_hours: float
    selfie_retry_minutes: int
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    email_from: str
    email_from_name: str
    photos_dir: Path
    data_dir: Path


def _number(org_id: str, name: str, value: str, kind):
    try:
        return kind(value)
    except ValueError:
        raise ApiError(500, f"Org '{org_id}': {name} must be a number (it is '{value}').")


def settings_for(org_id: str) -> Settings:
    """The org's Video PD settings. Raises ApiError if the org isn't set up."""
    org_id = (org_id or "").strip().lower() or DEFAULT_ORG_ID
    try:
        org = org_store.get_org(org_id)
    except org_store.OrgNotFound:
        raise ApiError(404, f"Organisation '{org_id}' is not set up: add it (API key and secret) on the admin page.")

    use_dotenv = org_id == DEFAULT_ORG_ID

    def get(name: str, default: str = "") -> str:
        value = org_store.org_env(org, name)
        if value is None and use_dotenv:
            value = os.environ.get(f"MUTHOOT_{name}")
        value = (value or "").strip()
        return value or default

    smtp_host = get("SMTP_HOST", "smtp.gmail.com")
    smtp_user = get("SMTP_USER")
    smtp_password = get("SMTP_PASSWORD")
    if "gmail" in smtp_host:
        # Google shows app passwords in groups ("abcd efgh ..."); the spaces aren't part of it.
        smtp_password = smtp_password.replace(" ", "")
    key_file = get("GOOGLE_SERVICE_ACCOUNT_FILE")

    return Settings(
        org_id=org_id,
        api_key=org["apiKey"],
        secret=org["secret"],
        zeroruntime_agent_id=get("ZERORUNTIME_AGENT_ID"),
        client_url=get("CLIENT_URL", "http://localhost:3000").rstrip("/"),
        google_sheet_id=get("GOOGLE_SHEET_ID"),
        google_service_account_json=get("GOOGLE_SERVICE_ACCOUNT_JSON"),
        google_service_account_file=str(_path(key_file, Path())) if key_file else "",
        google_photos_folder_id=get("GOOGLE_PHOTOS_FOLDER_ID"),
        link_valid_hours=_number(org_id, "LINK_VALID_HOURS", get("LINK_VALID_HOURS", "24"), float),
        selfie_retry_minutes=_number(org_id, "SELFIE_RETRY_MINUTES", get("SELFIE_RETRY_MINUTES", "30"), int),
        smtp_host=smtp_host,
        smtp_port=_number(org_id, "SMTP_PORT", get("SMTP_PORT", "587"), int),
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        email_from=get("EMAIL_FROM") or smtp_user,
        email_from_name=get("EMAIL_FROM_NAME", "Muthoot Finance Video PD"),
        photos_dir=_path(get("PHOTOS_DIR"), PACKAGE_DIR / "photos"),
        data_dir=DATA_ROOT / org_id,
    )
