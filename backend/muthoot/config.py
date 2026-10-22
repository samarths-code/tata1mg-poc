"""Muthoot Video PD settings, from backend/.env (MUTHOOT_* keys).

VideoSDK credentials are NOT here: they are the "muthoot" org's API key and secret
in orgs.json (admin page), like every other org on this backend.
"""
import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PACKAGE_DIR.parent


def _path(value: str, default: Path) -> Path:
    """A relative path is read from the backend folder."""
    if not value:
        return default
    path = Path(value)
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()


# The org in orgs.json whose VideoSDK key/secret this flow uses.
ORG_ID = os.environ.get("MUTHOOT_ORG_ID", "muthoot").strip().lower()

VIDEOSDK_API = "https://api.videosdk.live"
ZERORUNTIME_API = "https://api.zeroruntime.ai"
# The deployed Zero Runtime agent (same VideoSDK account as the org's key).
ZERORUNTIME_AGENT_ID = os.environ.get("MUTHOOT_ZERORUNTIME_AGENT_ID", "").strip()

# The customer page's address; the PD links are built on it.
CLIENT_URL = os.environ.get("MUTHOOT_CLIENT_URL", "http://localhost:3000").strip().rstrip("/")

# M2-6: wait after 3 failed selfies. The agent reads its own copy for its goodbye.
SELFIE_RETRY_MINUTES = int(os.environ.get("MUTHOOT_SELFIE_RETRY_MINUTES", "30"))
# A Video PD link works for this many hours after it is made (0 = no limit).
LINK_VALID_HOURS = float(os.environ.get("MUTHOOT_LINK_VALID_HOURS", "24"))

# The Google Sheet (LOS, Results, Events tabs), shared with the service account.
GOOGLE_SHEET_ID = os.environ.get("MUTHOOT_GOOGLE_SHEET_ID", "").strip()
_key_file = os.environ.get("MUTHOOT_GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()
GOOGLE_SERVICE_ACCOUNT_FILE = str(_path(_key_file, Path())) if _key_file else ""
# Optional Drive folder of reference photos, shared with the service account.
GOOGLE_PHOTOS_FOLDER_ID = os.environ.get("MUTHOOT_GOOGLE_PHOTOS_FOLDER_ID", "").strip()

# Emailing the Video PD links (the demo's stand-in for SMS). For Gmail use an App
# Password. Empty MUTHOOT_SMTP_USER: no emails are sent.
SMTP_HOST = os.environ.get("MUTHOOT_SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.environ.get("MUTHOOT_SMTP_PORT", "587"))  # 587 = STARTTLS, 465 = SSL
SMTP_USER = os.environ.get("MUTHOOT_SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("MUTHOOT_SMTP_PASSWORD", "").strip()
if "gmail" in SMTP_HOST:
    # Google shows app passwords in groups ("abcd efgh ..."); the spaces aren't part of it.
    SMTP_PASSWORD = SMTP_PASSWORD.replace(" ", "")
EMAIL_FROM = os.environ.get("MUTHOOT_EMAIL_FROM", "").strip() or SMTP_USER
EMAIL_FROM_NAME = os.environ.get("MUTHOOT_EMAIL_FROM_NAME", "Muthoot Finance Video PD").strip()

# Files the flow writes: journey events, selfies (for the auditor), results that
# couldn't reach the sheet. Plus the face model and local reference photos.
DATA_DIR = _path(os.environ.get("MUTHOOT_DATA_DIR", ""), PACKAGE_DIR / "data")
PHOTOS_DIR = _path(os.environ.get("MUTHOOT_PHOTOS_DIR", ""), PACKAGE_DIR / "photos")
MODELS_DIR = PACKAGE_DIR / "models"
LOGO_FILE = PACKAGE_DIR / "assets" / "muthoot-logo.png"
