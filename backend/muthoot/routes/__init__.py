"""Muthoot Finance AI Video PD routes, all under /api/v1/muthoot.

  GET  /demo/customers                        demo.py     start page: the LOS customers
  POST /demo/customers/<id>/link              demo.py     new PD link for one, emailed
  POST /sessions/from-link                    sessions.py customer opened the link: room + token
  POST /sessions/<room_id>/consents           sessions.py 4 consents saved, agent sent in
  POST /verify/face                           verify.py   face count (camera checks)
  POST /verify/selfie                         verify.py   selfie: faces + face match
  GET  /verify/selfie/<room_id>/<capture_id>  verify.py   that check's result (agent polls)
  POST /results                               results.py  agent: one row in the Results tab
  POST /events                                events.py   journey event (agent + page)
  GET  /health                                health.py

Each module adds its routes to the one blueprint `bp`. Handlers only read the
request and shape the reply; the work is in muthoot/services.

Org: every handler works with one org's settings (org_settings()): the org whose
link opened the room, else the X-Org-Id header (or orgId), else MUTHOOT_ORG_ID.
"""
import logging

from flask import Blueprint, jsonify

from ..config import Settings, settings_for
from ..errors import ApiError
from ..services.sessions import org_id_of
from ..services.sheet import SheetError

try:
    from ... import org_store
except ImportError:  # backend run as a script: python3 app.py
    import org_store

logger = logging.getLogger(__name__)

URL_PREFIX = "/api/v1/muthoot"
bp = Blueprint("muthoot", __name__, url_prefix=URL_PREFIX)


def org_settings(room_id: str | None = None) -> Settings:
    """The settings of the org this request is for.

    A known room decides: the agent's calls carry no org id, and a header can't
    point a room at another org's sheet. Otherwise the page's X-Org-Id header
    (or orgId in the query or body), the same id the other org frontends send."""
    org_id = (org_id_of(room_id) if room_id else None) or org_store.request_org_id()
    return settings_for(org_id)


@bp.errorhandler(ApiError)
def _api_error(error: ApiError):
    return jsonify({"detail": error.detail}), error.status


@bp.errorhandler(SheetError)
def _sheet_error(error: SheetError):
    logger.error("Sheet: %s", error)
    return jsonify({"detail": "We couldn't load your Video PD details. Please try again in a minute."}), 503


# Imported last: each module registers its routes on `bp`.
from . import demo, events, health, results, sessions, verify  # noqa: E402,F401

__all__ = ["bp", "URL_PREFIX", "org_settings"]
