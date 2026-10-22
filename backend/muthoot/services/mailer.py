"""Emails a customer their Video PD link over SMTP: the demo's stand-in for the SMS
a real customer gets (M2-2). HTML with an embedded logo, plus a plain-text part."""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from html import escape

from ..config import LOGO_FILE, Settings

logger = logging.getLogger(__name__)

RED, DARK = "#D21D25", "#9E1218"


class EmailError(Exception):
    pass


def email_configured(cfg: Settings) -> bool:
    return bool(cfg.smtp_user and cfg.smtp_password and cfg.email_from)


def _text(name: str, application_id: str, link: str) -> str:
    return (
        f"Dear {name},\n\n"
        "Your Video PD (Personal Discussion) for your Muthoot Finance personal loan is "
        f"ready. Application ID: {application_id}.\n\n"
        f"Open this link on your phone to start: {link}\n\n"
        "Before you start: keep your camera and microphone on, sit in a quiet place with "
        "good light, and keep your bank account details handy. It takes about 10 minutes.\n\n"
        "Regards,\nMuthoot Finance\n\n"
        "Muthoot Finance never asks for any payment to process your loan. Please do not "
        "share this link with anyone."
    )


def _html(name: str, application_id: str, link: str, logo_cid: str | None) -> str:
    name, application_id, link = escape(name), escape(application_id), escape(link, quote=True)
    logo = (
        f'<img src="cid:{logo_cid}" alt="Muthoot Finance" height="36" style="display:block;height:36px">'
        if logo_cid
        else f'<span style="font-size:20px;font-weight:700;color:{RED}">Muthoot Finance</span>'
    )
    text = "font-size:15px;line-height:1.6;color:#333333"
    return f"""\
<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-top:3px solid {RED}">
  <tr><td style="padding:22px 28px 18px;border-bottom:1px solid #eeeeee">{logo}</td></tr>
  <tr><td style="padding:26px 28px 8px">
    <p style="margin:0 0 14px;{text}">Dear {name},</p>
    <p style="margin:0 0 14px;{text}">Your Video PD (Personal Discussion) for your personal loan application <b>{application_id}</b> is ready. It is a short video call and takes about 10 minutes.</p>
    <p style="margin:0 0 22px;{text}">Please open the link below on your phone to begin.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:{RED};border-radius:6px">
      <a href="{link}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Start Video PD</a>
    </td></tr></table>
    <p style="margin:12px 0 22px;font-size:12px;line-height:1.5;color:#777777">If the button does not work, copy this link into your browser:<br><a href="{link}" style="color:{DARK};word-break:break-all">{link}</a></p>
    <p style="margin:0 0 6px;{text}"><b>Before you start</b></p>
    <p style="margin:0 0 22px;{text}">Keep your camera and microphone on, sit in a quiet place with good light, and keep your bank account details handy.</p>
    <p style="margin:0 0 4px;{text}">Regards,</p>
    <p style="margin:0 0 24px;{text}">Muthoot Finance</p>
  </td></tr>
  <tr><td style="padding:16px 28px 22px;border-top:1px solid #eeeeee;font-size:12px;line-height:1.6;color:#777777">Muthoot Finance never asks for any payment to process your loan. Please do not share this link with anyone.</td></tr>
</table>
</td></tr></table>
</body></html>"""


def send_link_email(cfg: Settings, to: str, name: str, application_id: str, link: str) -> None:
    """Raises EmailError."""
    if not email_configured(cfg):
        raise EmailError(f"Org '{cfg.org_id}': email is not set up (SMTP_USER and SMTP_PASSWORD on the admin page).")
    message = EmailMessage()
    message["Subject"] = f"Your Muthoot Finance Video PD link · Application {application_id}"
    message["From"] = formataddr((cfg.email_from_name, cfg.email_from))
    message["To"] = to
    message.set_content(_text(name, application_id, link))

    logo_cid = make_msgid(domain="muthoot.videopd")[1:-1] if LOGO_FILE.is_file() else None
    message.add_alternative(_html(name, application_id, link, logo_cid), subtype="html")
    if logo_cid:
        # Embedded (cid:), so it shows without a public image URL.
        message.get_payload()[1].add_related(
            LOGO_FILE.read_bytes(), maintype="image", subtype="png", cid=f"<{logo_cid}>"
        )

    try:
        if cfg.smtp_port == 465:
            with smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, context=ssl.create_default_context(), timeout=20) as smtp:
                smtp.login(cfg.smtp_user, cfg.smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=20) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(cfg.smtp_user, cfg.smtp_password)
                smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as error:
        raise EmailError(f"Couldn't email {to}: {type(error).__name__}: {error}") from error
    logger.info("Video PD link for %s emailed to %s", application_id, to)
