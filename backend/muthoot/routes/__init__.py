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
"""
import logging

from flask import Blueprint, jsonify

from ..errors import ApiError
from ..services.sheet import SheetError

logger = logging.getLogger(__name__)

URL_PREFIX = "/api/v1/muthoot"
bp = Blueprint("muthoot", __name__, url_prefix=URL_PREFIX)


@bp.errorhandler(ApiError)
def _api_error(error: ApiError):
    return jsonify({"detail": error.detail}), error.status


@bp.errorhandler(SheetError)
def _sheet_error(error: SheetError):
    logger.error("Sheet: %s", error)
    return jsonify({"detail": "We couldn't load your Video PD details. Please try again in a minute."}), 503


# Imported last: each module registers its routes on `bp`.
from . import demo, events, health, results, sessions, verify  # noqa: E402,F401

__all__ = ["bp", "URL_PREFIX"]
