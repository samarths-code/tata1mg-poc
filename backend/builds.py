"""
Frontend build deploys — the admin page uploads a .zip of a client's CRA
build and it replaces BUILDS_ROOT/<domain>/public, which nginx serves.

    BUILDS_ROOT/<domain>/
        public/            live build (nginx root)
        public.prev/       the build before it (manual fallback only)
        build-info.json    what was uploaded and when (not served)
        .deploy.lock       serialises uploads across gunicorn workers

BUILDS_ROOT defaults to /var/www. The <domain> directory must already exist
(created with the nginx vhost); uploads never create sites.
"""
import datetime
import fcntl
import json
import os
import posixpath
import shutil
import stat
import tempfile
import zipfile

try:
    from . import org_store
except ImportError:
    import org_store

BUILDS_ROOT = os.environ.get("BUILDS_ROOT", "/var/www")

MAX_ZIP_BYTES = 20 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_FILES = 2000


class BuildError(Exception):
    """A problem with the upload the admin can fix — shown as-is (400)."""


def site_dir(domain: str) -> str:
    if not org_store.DOMAIN_PATTERN.match(domain or ""):
        raise BuildError(f"Invalid frontend domain: {domain!r}")
    return os.path.join(BUILDS_ROOT, domain)


def build_info(domain: str):
    """Last upload's info for the domain, or None."""
    try:
        with open(os.path.join(site_dir(domain), "build-info.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError, BuildError):
        return None


def site_exists(domain: str) -> bool:
    try:
        return os.path.isdir(site_dir(domain))
    except BuildError:
        return False


def _entries(zf: zipfile.ZipFile):
    """Validated (archive name, relative path) for every file in the zip.
    Strips a single wrapping folder such as "build/"."""
    files = []
    total = 0
    for info in zf.infolist():
        name = info.filename
        if info.is_dir() or name.startswith("__MACOSX/") or posixpath.basename(name) == ".DS_Store":
            continue
        if stat.S_ISLNK(info.external_attr >> 16):
            raise BuildError(f"Symlinks are not allowed in the zip: {name}")
        norm = posixpath.normpath(name.replace("\\", "/"))
        if norm.startswith("/") or norm == ".." or norm.startswith("../") or ":" in norm.split("/")[0]:
            raise BuildError(f"Unsafe path in zip: {name}")
        total += info.file_size
        if total > MAX_UNCOMPRESSED_BYTES:
            raise BuildError(f"Build is larger than {MAX_UNCOMPRESSED_BYTES // (1024 * 1024)} MB unzipped")
        files.append((info, norm))
        if len(files) > MAX_FILES:
            raise BuildError(f"Zip has more than {MAX_FILES} files")
    if not files:
        raise BuildError("Zip is empty")

    names = [n for _, n in files]
    if "index.html" not in names:
        tops = {n.split("/", 1)[0] for n in names}
        if len(tops) == 1 and all("/" in n for n in names):
            prefix = tops.pop() + "/"
            files = [(i, n[len(prefix):]) for i, n in files]
            names = [n for _, n in files]
    if "index.html" not in names:
        raise BuildError("No index.html at the top of the zip — is this a build folder?")
    return files


def _built_for_org(zf: zipfile.ZipFile, files, org_id: str) -> bool:
    needle = org_id.encode()
    for info, rel in files:
        if rel.startswith("static/js/") and rel.endswith(".js"):
            with zf.open(info) as f:
                if needle in f.read():
                    return True
    return False


def deploy_zip(org_id: str, domain: str, upload, filename: str, force: bool = False) -> dict:
    """Validate the uploaded zip and make it the live build for the domain."""
    root = site_dir(domain)
    if not os.path.isdir(root):
        raise BuildError(f"Site {domain} is not set up on the server ({root} missing)")

    with tempfile.TemporaryFile() as tmp:
        shutil.copyfileobj(upload, tmp, 1024 * 1024)
        size = tmp.tell()
        if size > MAX_ZIP_BYTES:
            raise BuildError(f"Zip is larger than {MAX_ZIP_BYTES // (1024 * 1024)} MB")
        tmp.seek(0)
        try:
            zf = zipfile.ZipFile(tmp)
        except zipfile.BadZipFile:
            raise BuildError("Not a valid .zip file")

        with zf, open(os.path.join(root, ".deploy.lock"), "w") as lock:
            files = _entries(zf)
            if not force and not _built_for_org(zf, files, org_id):
                raise BuildError(
                    f"This build doesn't mention org \"{org_id}\" — was it built with "
                    f"REACT_APP_ORG_ID={org_id}? Tick \"skip org check\" to upload anyway."
                )

            fcntl.flock(lock, fcntl.LOCK_EX)
            incoming = tempfile.mkdtemp(dir=root, prefix=".incoming-")
            try:
                for info, rel in files:
                    dest = os.path.join(incoming, rel)
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with zf.open(info) as src, open(dest, "wb") as out:
                        shutil.copyfileobj(src, out)
                    os.chmod(dest, 0o644)
                for dirpath, _, _ in os.walk(incoming):
                    os.chmod(dirpath, 0o755)

                live = os.path.join(root, "public")
                prev = os.path.join(root, "public.prev")
                if os.path.isdir(live):
                    shutil.rmtree(prev, ignore_errors=True)
                    os.rename(live, prev)
                os.rename(incoming, live)
            except BaseException:
                shutil.rmtree(incoming, ignore_errors=True)
                raise

            info = {
                "orgId": org_id,
                "zip": os.path.basename(filename or "build.zip"),
                "zipBytes": size,
                "files": len(files),
                "uploadedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
                "forced": bool(force),
            }
            with open(os.path.join(root, "build-info.json"), "w", encoding="utf-8") as f:
                json.dump(info, f, indent=2)
            return info
