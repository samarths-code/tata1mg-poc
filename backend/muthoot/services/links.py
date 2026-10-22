"""Video PD links (<client URL>/?pd=<application_id>.<issued>.<signature>), written
into the LOS tab's pd_link column and emailed. The HMAC covers the ID and issue time,
so neither can be changed; only the link currently in the sheet is accepted."""
import hashlib
import hmac
import logging
import time
from urllib.parse import parse_qs, quote, urlparse

from ..config import Settings
from .mailer import EmailError, email_configured, send_link_email
from .los import load_customers
from .sheet import LINK_COLUMN, SheetError, write_column

logger = logging.getLogger(__name__)


def _signature(cfg: Settings, application_id: str, issued: str) -> str:
    message = f"videopd-link:{application_id}:{issued}".encode()
    # Signed with the org's VideoSDK secret (orgs.json): one org's link fails for another.
    return hmac.new(cfg.secret.encode(), message, hashlib.sha256).hexdigest()[:24]


def link_token(cfg: Settings, application_id: str) -> str:
    issued = str(int(time.time()))
    return f"{application_id}.{issued}.{_signature(cfg, application_id, issued)}"


def read_link_token(cfg: Settings, token: str) -> tuple[str, int] | None:
    """(application ID, issued time), or None if the token was changed."""
    parts = token.rsplit(".", 2)
    if len(parts) != 3 or not parts[1].isdigit():
        return None
    application_id, issued, signature = parts
    if not application_id or not hmac.compare_digest(signature, _signature(cfg, application_id, issued)):
        return None
    return application_id, int(issued)


def token_of(link: str) -> str:
    return parse_qs(urlparse(link).query).get("pd", [""])[0] if link else ""


def link_problem(cfg: Settings, token: str, current_link: str, issued: int) -> str | None:
    """Why a correctly signed token can't be used, else None: only the customer's
    newest link (the one in the sheet) works, and only for the org's LINK_VALID_HOURS."""
    if token != token_of(current_link):
        return "This link is no longer valid. Please open the latest Video PD link sent to your email."
    if cfg.link_valid_hours and time.time() - issued > cfg.link_valid_hours * 3600:
        return "This link has expired. Please contact Muthoot Finance for a new Video PD link."
    return None


def pd_link(cfg: Settings, application_id: str) -> str:
    return f"{cfg.client_url}/?pd={quote(link_token(cfg, application_id))}"


def issue_link(cfg: Settings, customer_id: str) -> tuple[dict, str] | None:
    """The demo start page's button: a new link for one customer, saved in the sheet
    (the previous one stops working). Returns (customer, link), or None if there is
    no such customer. The email is sent afterwards by email_link, so the page
    doesn't wait for it."""
    # The start page has just listed the customers, so the short-lived cached read
    # is current enough.
    customer = load_customers(cfg).get(customer_id)
    if customer is None:
        return None
    link = pd_link(cfg, customer_id)
    # Saved before replying: opening the link checks it against the sheet.
    write_column(cfg, {customer_id: link}, LINK_COLUMN)
    logger.info("Video PD link for %s (%s): %s", customer_id, customer["name"], link)
    return customer, link


def will_email(cfg: Settings, customer: dict) -> bool:
    return bool(customer.get("email")) and email_configured(cfg)


def email_link(cfg: Settings, customer_id: str, customer: dict, link: str) -> None:
    """Runs after the page has its reply: emails the link and notes it in the
    email_sent_link column. A failure is logged."""
    try:
        send_link_email(cfg, customer["email"], customer["name"], customer_id, link)
        write_column(cfg, {customer_id: link}, "email_sent_link")
        logger.info("Video PD link emailed to %s", customer_id)
    except (EmailError, SheetError) as error:
        logger.error("%s", error)
