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

import org_store
import org_vars

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

# The org variables this flow reads are listed in muthoot/README.md (Setup).


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


def settings_for(org_id: str) -> Settings:
    """The org's Video PD settings. Raises ApiError if the org isn't set up."""
    org_id = (org_id or "").strip().lower() or DEFAULT_ORG_ID
    try:
        org = org_store.get_org(org_id)
    except org_store.OrgNotFound:
        raise ApiError(404, f"Organisation '{org_id}' is not set up: add it (API key and secret) on the admin page.")

    # Only the default org also reads the old MUTHOOT_* keys from .env.
    var = org_vars.reader(org, env_prefix="MUTHOOT_" if org_id == DEFAULT_ORG_ID else None).get

    try:
        smtp_host = var("SMTP_HOST", "smtp.gmail.com")
        smtp_user = var("SMTP_USER")
        smtp_password = var("SMTP_PASSWORD")
        if "gmail" in smtp_host:
            # Google shows app passwords in groups ("abcd efgh ..."); the spaces aren't part of it.
            smtp_password = smtp_password.replace(" ", "")
        key_file = var("GOOGLE_SERVICE_ACCOUNT_FILE")

        return Settings(
            org_id=org_id,
            api_key=org["apiKey"],
            secret=org["secret"],
            zeroruntime_agent_id=var("ZERORUNTIME_AGENT_ID"),
            client_url=var("CLIENT_URL", "http://localhost:3000").rstrip("/"),
            google_sheet_id=var("GOOGLE_SHEET_ID"),
            google_service_account_json=var("GOOGLE_SERVICE_ACCOUNT_JSON"),
            google_service_account_file=str(_path(key_file, Path())) if key_file else "",
            google_photos_folder_id=var("GOOGLE_PHOTOS_FOLDER_ID"),
            link_valid_hours=var("LINK_VALID_HOURS", 24.0, float),
            selfie_retry_minutes=var("SELFIE_RETRY_MINUTES", 30, int),
            smtp_host=smtp_host,
            smtp_port=var("SMTP_PORT", 587, int),
            smtp_user=smtp_user,
            smtp_password=smtp_password,
            email_from=var("EMAIL_FROM") or smtp_user,
            email_from_name=var("EMAIL_FROM_NAME", "Muthoot Finance Video PD"),
            photos_dir=_path(var("PHOTOS_DIR"), PACKAGE_DIR / "photos"),
            data_dir=DATA_ROOT / org_id,
        )
    except org_vars.OrgVarError as error:
        raise ApiError(500, str(error))
