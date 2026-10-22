"""Request-body checks for the Muthoot routes (FastAPI's model validation, by hand):
a bad body is a 422 with {"detail": ...}."""
from flask import request

from ..errors import ApiError


def json_body() -> dict:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(422, "The request body must be a JSON object.")
    return body


def field(body: dict, name: str, kind, required: bool = True):
    """body[name] if it is of `kind` (bool is not a number), else 422."""
    value = body.get(name)
    if value is None and not required:
        return None
    is_number = kind in (int, float) and isinstance(value, (int, float)) and not isinstance(value, bool)
    if not (is_number or (kind not in (int, float) and isinstance(value, kind))):
        raise ApiError(422, f"'{name}' is missing or not a {kind.__name__}.")
    return value
