"""M2-6: the customer's reference face photo, from the org's PHOTOS_DIR or its Drive folder
GOOGLE_PHOTOS_FOLDER_ID (org variables), named after the application (APP1007.jpg) unless the LOS
tab's face_photo gives a Drive link or a file name (extension optional)."""
import re
from pathlib import Path

from ..config import Settings
from .sheet import SheetError, google_session

DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
# .../file/d/<id>/view, .../open?id=<id>, .../uc?id=<id>
DRIVE_FILE_ID = re.compile(r"(?:/d/|[?&]id=)([A-Za-z0-9_-]{20,})")
PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]

# Drive file ID -> (bytes, name). A selfie is retried up to 3 times; download once.
_downloaded: dict[str, tuple[bytes, str]] = {}


class PhotoError(Exception):
    pass


def _drive_get(cfg: Settings, url: str, params: dict):
    try:
        response = google_session(cfg).get(url, params={**params, "supportsAllDrives": "true"}, timeout=30)
    except SheetError as error:
        raise PhotoError(str(error)) from error
    if response.status_code == 403 and "has not been used" in response.text:
        raise PhotoError("The Google Drive API is off. Enable it in the service account's Cloud project.")
    if response.status_code == 404:
        raise PhotoError("Drive photo not found. Share it (or its folder) with the service account.")
    if not response.ok:
        raise PhotoError(f"Drive error {response.status_code}: {response.text[:200]}")
    return response


def _download(cfg: Settings, file_id: str) -> tuple[bytes, str]:
    if file_id not in _downloaded:
        meta = _drive_get(cfg, f"{DRIVE_FILES_URL}/{file_id}", {"fields": "name,mimeType"}).json()
        if not meta.get("mimeType", "").startswith("image/"):
            raise PhotoError(f"Drive file {meta.get('name', file_id)} is not an image.")
        content = _drive_get(cfg, f"{DRIVE_FILES_URL}/{file_id}", {"alt": "media"}).content
        _downloaded[file_id] = (content, meta["name"])
    return _downloaded[file_id]


def _find_in_folder(cfg: Settings, names: list[str]) -> str | None:
    quoted = [name.replace("\\", "\\\\").replace("'", "\\'") for name in names]
    any_name = " or ".join(f"name = '{name}'" for name in quoted)
    query = f"'{cfg.google_photos_folder_id}' in parents and ({any_name}) and trashed = false"
    files = _drive_get(
        cfg,
        DRIVE_FILES_URL,
        {"q": query, "fields": "files(id)", "includeItemsFromAllDrives": "true", "pageSize": 1},
    ).json().get("files", [])
    return files[0]["id"] if files else None


def _photo_named_after(cfg: Settings, application_id: str) -> tuple[bytes, str]:
    names = [f"{application_id}{ext}" for ext in PHOTO_EXTENSIONS]
    for name in names:
        local = cfg.photos_dir / name
        if local.is_file():
            return local.read_bytes(), local.name
    if cfg.google_photos_folder_id:
        file_id = _find_in_folder(cfg, names)
        if file_id:
            return _download(cfg, file_id)
    raise PhotoError(
        f"No reference photo: add {application_id}.jpg to the photos folder "
        "or set face_photo in the LOS tab"
    )


def load_reference_photo(cfg: Settings, value: str, application_id: str) -> tuple[bytes, str]:
    """(image bytes, file name) for a customer's face_photo cell. Raises PhotoError."""
    value = value.strip()
    if not value:
        return _photo_named_after(cfg, application_id)

    if value.startswith("http"):
        if "/folders/" in value:
            raise PhotoError("face_photo is a folder link. Paste the photo's own link instead.")
        match = DRIVE_FILE_ID.search(value)
        if not match:
            raise PhotoError("face_photo link is not a Google Drive file link.")
        return _download(cfg, match.group(1))

    if not Path(value).suffix:
        return _photo_named_after(cfg, Path(value).name)

    local = cfg.photos_dir / Path(value).name
    if local.is_file():
        return local.read_bytes(), local.name

    if cfg.google_photos_folder_id:
        file_id = _find_in_folder(cfg, [Path(value).name])
        if file_id:
            return _download(cfg, file_id)
    raise PhotoError(f"Reference photo missing: {value}")
