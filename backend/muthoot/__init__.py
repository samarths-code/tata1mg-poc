"""Muthoot Finance AI Video PD (replaces its separate FastAPI backend).

  routes/    Flask blueprint, every route under /api/v1/muthoot
  services/  the logic: Google Sheet, links, email, VideoSDK, face checks, results

app.py registers it with:  app.register_blueprint(muthoot.bp); muthoot.start_event_writer()
See muthoot/README.md for setup.
"""
import atexit
import logging
import threading
import time

from .routes import URL_PREFIX, bp
from .services import journey_events

# The flow's own log lines (links made, selfie results, sheet errors) at INFO, also
# under gunicorn, whose root logger shows warnings only.
_logger = logging.getLogger(__name__)
if not _logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    _logger.addHandler(_handler)
    _logger.setLevel(logging.INFO)
    _logger.propagate = False

_writer_started = False


def _keep_writing_events() -> None:
    while True:
        time.sleep(journey_events.FLUSH_SECONDS)
        journey_events.flush_to_sheet()


def start_event_writer() -> None:
    """Copies journey events to the sheet's Events tab every FLUSH_SECONDS.
    Call once after registering the blueprint (one thread per process)."""
    global _writer_started
    if _writer_started:
        return
    _writer_started = True
    threading.Thread(target=_keep_writing_events, name="muthoot-events", daemon=True).start()
    atexit.register(journey_events.flush_to_sheet)  # the last few events on shutdown


__all__ = ["bp", "URL_PREFIX", "start_event_writer"]
