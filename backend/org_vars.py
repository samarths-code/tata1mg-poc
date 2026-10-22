"""
Org variables — per-org settings (sheet IDs, agent IDs, SMTP logins, ...) kept
in each org's entry in orgs.json, next to its VideoSDK key and secret, and
edited one at a time on the admin page. The one place that reads and writes them.

Stored on the org as:

    "env":        {"GOOGLE_SHEET_ID": "...", "SMTP_PASSWORD": "..."}
    "envSecrets": ["SMTP_PASSWORD"]          # never sent back to the admin page

Reading (any feature):

    v = org_vars.reader(org)                     # org from org_store.get_org()
    v.get("GOOGLE_SHEET_ID")                     # "" when unset
    v.get("SMTP_PORT", 587, int)                 # typed; bad value -> OrgVarError
    org_vars.reader(org, env_prefix="MUTHOOT_")  # unset -> os.environ["MUTHOOT_<KEY>"]

Declaring (so the admin page suggests the names and masks the secret ones):

    org_vars.register("Muthoot Video PD", {"GOOGLE_SHEET_ID": ("help text", False)})

Writing (admin page): set_var() / delete_var(); list_public() / stored() for
showing and keeping them.
"""
import os
import re
from typing import Optional

try:
    from . import org_store
except ImportError:  # run as a script: python3 app.py
    import org_store

ENV_FIELD = "env"
SECRETS_FIELD = "envSecrets"
KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]{0,63}$")
MAX_VALUE_CHARS = 20000  # room for a pasted service-account JSON key

# KEY -> {"group", "help", "secret"}; filled by register().
KNOWN_KEYS: dict = {}


class OrgVarError(ValueError):
    """A variable name or value that isn't allowed, or a value of the wrong type."""


def register(group: str, keys: dict) -> None:
    """keys: {KEY: (help text, is_secret)} — the variables a feature reads."""
    for key, (help_text, secret) in keys.items():
        KNOWN_KEYS[key] = {"group": group, "help": help_text, "secret": bool(secret)}


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

def _cast(org: dict, key: str, value: str, cast):
    if cast is bool:
        return value.lower() in ("1", "true", "yes", "on")
    try:
        return cast(value)
    except ValueError:
        raise OrgVarError(f"Org '{org.get('id', '?')}': {key} must be {cast.__name__} (it is '{value}')")


def get_var(org: dict, key: str, default=None, cast=str, env_fallback: Optional[str] = None):
    """The org's value for `key`, else os.environ[env_fallback], else `default`.
    Blank counts as unset; the value is stripped and passed through `cast`
    (str, int, float or bool)."""
    value = (org.get(ENV_FIELD) or {}).get(key)
    if (value is None or not str(value).strip()) and env_fallback:
        value = os.environ.get(env_fallback)
    if value is None or not str(value).strip():
        return default
    return _cast(org, key, str(value).strip(), cast)


class OrgVars:
    """Typed reads of one org's variables (see the module docstring)."""

    def __init__(self, org: dict, env_prefix: Optional[str] = None):
        self.org = org
        self.env_prefix = env_prefix

    def get(self, key: str, default="", cast=str):
        fallback = f"{self.env_prefix}{key}" if self.env_prefix else None
        return get_var(self.org, key, default, cast, env_fallback=fallback)


def reader(org: dict, env_prefix: Optional[str] = None) -> OrgVars:
    """env_prefix: also read unset variables from .env as <prefix><KEY> — for
    settings that used to live in .env before they were per org."""
    return OrgVars(org, env_prefix)


# ---------------------------------------------------------------------------
# Writing (admin page)
# ---------------------------------------------------------------------------

def _clean(key: str, value) -> tuple:
    key = str(key or "").strip().upper()
    if not KEY_PATTERN.match(key):
        raise OrgVarError("Name: capital letters, digits and _ (e.g. GOOGLE_SHEET_ID)")
    if not isinstance(value, str):
        raise OrgVarError("Value must be text")
    value = value.strip()
    if not value:
        raise OrgVarError("Value is empty (use Delete to remove a variable)")
    if len(value) > MAX_VALUE_CHARS:
        raise OrgVarError(f"Value is longer than {MAX_VALUE_CHARS} characters")
    return key, value


def set_var(org_id: str, key: str, value: str, secret: bool = False) -> dict:
    """Add or update one variable; returns the updated org. Registered secret
    keys are always secret. Raises OrgVarError or org_store.OrgNotFound."""
    key, value = _clean(key, value)
    secret = bool(secret) or KNOWN_KEYS.get(key, {}).get("secret", False)

    def change(org: dict) -> None:
        env = {**(org.get(ENV_FIELD) or {}), key: value}
        secrets = [k for k in (org.get(SECRETS_FIELD) or []) if k != key and k in env]
        if secret:
            secrets.append(key)
        org[ENV_FIELD], org[SECRETS_FIELD] = env, sorted(secrets)

    return org_store.update_org(org_id, change)


def delete_var(org_id: str, key: str) -> dict:
    """Remove one variable; returns the updated org. Raises org_store.OrgNotFound."""
    key = str(key or "").strip().upper()

    def change(org: dict) -> None:
        env = {k: v for k, v in (org.get(ENV_FIELD) or {}).items() if k != key}
        org[ENV_FIELD] = env
        org[SECRETS_FIELD] = [k for k in (org.get(SECRETS_FIELD) or []) if k in env]

    return org_store.update_org(org_id, change)


def mask(value: str) -> str:
    return f"••••{value[-4:]}" if len(value) > 4 else "••••"


def list_public(org: dict) -> list:
    """[{key, value, secret}] for the admin page; secret values are masked."""
    secrets = set(org.get(SECRETS_FIELD) or [])
    return [
        {"key": key, "secret": key in secrets, "value": mask(value) if key in secrets else value}
        for key, value in sorted((org.get(ENV_FIELD) or {}).items())
    ]


def stored(org: dict) -> dict:
    """The org's variable fields as stored, to carry over when the org itself is re-saved."""
    return {ENV_FIELD: dict(org.get(ENV_FIELD) or {}), SECRETS_FIELD: list(org.get(SECRETS_FIELD) or [])}
