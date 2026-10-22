"""Muthoot Finance AI Video PD: its routes (routes.py, under /api/v1/muthoot) and the
background job that copies journey events to the sheet's Events tab every
events.FLUSH_SECONDS. See muthoot/README.md."""
import atexit
import threading
import time

from . import events
from .routes import bp

_flusher_started = False


def _keep_writing_events() -> None:
    while True:
        time.sleep(events.FLUSH_SECONDS)
        events.flush_to_sheet()


def start_event_writer() -> None:
    """Called once when the blueprint is registered (one thread per process)."""
    global _flusher_started
    if _flusher_started:
        return
    _flusher_started = True
    threading.Thread(target=_keep_writing_events, name="muthoot-events", daemon=True).start()
    atexit.register(events.flush_to_sheet)  # the last few events on shutdown


__all__ = ["bp", "start_event_writer"]
