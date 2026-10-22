"""The Google Sheet the demo runs on (LOS, Results and Events tabs), through a
service account the sheet is shared with as Editor."""
import threading
import time

import gspread
from gspread.utils import rowcol_to_a1

from . import config

LOS_TAB = "LOS"
RESULTS_TAB = "Results"
EVENTS_TAB = "Events"
LINK_COLUMN = "pd_link"

# The LOS tab is read when a link is opened and by the start page; a short cache
# keeps that well under the Sheets API limit (60 reads a minute).
CACHE_SECONDS = 30


class SheetError(Exception):
    pass


_lock = threading.Lock()
_client = None
_spreadsheet = None
_cache: dict = {"at": 0.0, "rows": None}


def google_session():
    """Signed-in HTTP session of the service account (Sheets + Drive scopes)."""
    global _client
    if _client is None:
        if not config.GOOGLE_SERVICE_ACCOUNT_FILE:
            raise SheetError("MUTHOOT_GOOGLE_SERVICE_ACCOUNT_FILE is not set in backend/.env.")
        try:
            _client = gspread.service_account(filename=config.GOOGLE_SERVICE_ACCOUNT_FILE)
        except Exception as error:  # missing or malformed key file
            raise SheetError(
                f"Couldn't load the service account key ({type(error).__name__}: {error})."
            ) from error
    return _client.http_client.session


def open_sheet() -> gspread.Spreadsheet:
    global _spreadsheet
    if _spreadsheet is None:
        if not config.GOOGLE_SHEET_ID:
            raise SheetError("MUTHOOT_GOOGLE_SHEET_ID is not set in backend/.env.")
        google_session()  # loads the key
        try:
            _spreadsheet = _client.open_by_key(config.GOOGLE_SHEET_ID)
        except Exception as error:  # missing key file, bad key, or sheet not shared
            raise SheetError(
                f"Couldn't open the sheet ({type(error).__name__}: {error}). "
                "Check the key file path and that the sheet is shared with the service account."
            ) from error
    return _spreadsheet


def _rows(values: list[list[str]]) -> list[dict]:
    """Turns a tab's cells into one dict per row, keyed by the header row."""
    if not values:
        return []
    header = [name.strip() for name in values[0]]
    rows = []
    for row in values[1:]:
        record = {name: (row[i].strip() if i < len(row) else "") for i, name in enumerate(header) if name}
        if any(record.values()):
            rows.append(record)
    return rows


def read_los(fresh: bool = False) -> list[dict]:
    """The LOS tab's rows, one dict per application (cached for CACHE_SECONDS)."""
    with _lock:
        if not fresh and _cache["rows"] is not None and time.time() - _cache["at"] < CACHE_SECONDS:
            return _cache["rows"]
        try:
            values = open_sheet().worksheet(LOS_TAB).get_all_values()
        except gspread.exceptions.GSpreadException as error:
            raise SheetError(f"Couldn't read the {LOS_TAB} tab: {error}") from error
        rows = _rows(values)
        _cache.update(at=time.time(), rows=rows)
        return rows


def write_column(values: dict[str, str], column_name: str) -> None:
    """Writes {application_id: value} into one LOS column, adding it if missing.
    Rows are found by application_id on a fresh read, so rows added meanwhile
    don't shift it."""
    if not values:
        return
    try:
        worksheet = open_sheet().worksheet(LOS_TAB)
        header = [name.strip() for name in worksheet.row_values(1)]
        if "application_id" not in header:
            raise SheetError(f"The {LOS_TAB} tab has no application_id column.")

        if column_name in header:
            column = header.index(column_name) + 1
        else:
            column = len(header) + 1
            if column > worksheet.col_count:
                worksheet.add_cols(column - worksheet.col_count)
            worksheet.update_cell(1, column, column_name)

        ids = worksheet.col_values(header.index("application_id") + 1)
        updates = [
            {"range": rowcol_to_a1(row, column), "values": [[values[application_id.strip()]]]}
            for row, application_id in enumerate(ids, start=1)
            if row > 1 and application_id.strip() in values
        ]
        if updates:
            worksheet.batch_update(updates)
    except gspread.exceptions.GSpreadException as error:
        raise SheetError(f"Couldn't write {column_name} to the {LOS_TAB} tab: {error}") from error
    finally:
        with _lock:
            _cache["rows"] = None  # next read sees the new values


def append_rows(tab: str, columns: list[str], rows: list[dict]) -> str:
    """Adds rows (dicts keyed by `columns`) to a tab in one write; returns its URL.
    Creates the tab and header if needed. Values go under the tab's own header, so
    a column added later or moved by hand doesn't shift old rows."""
    try:
        spreadsheet = open_sheet()
        try:
            worksheet = spreadsheet.worksheet(tab)
        except gspread.exceptions.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(tab, rows=100, cols=len(columns))

        header = [name.strip() for name in worksheet.row_values(1)]
        missing = [name for name in columns if name not in header]
        if missing:
            header += missing
            if len(header) > worksheet.col_count:
                worksheet.add_cols(len(header) - worksheet.col_count)
            worksheet.update([header], "A1")
            worksheet.format("1:1", {"textFormat": {"bold": True}})
            worksheet.freeze(rows=1)

        values = [
            ["" if row.get(name) is None else row.get(name) for name in header] for row in rows
        ]
        # RAW: what the customer said is stored as text, never run as a formula.
        worksheet.append_rows(values, table_range="A1")
        return worksheet.url
    except gspread.exceptions.GSpreadException as error:
        raise SheetError(f"Couldn't write to the {tab} tab: {error}") from error
