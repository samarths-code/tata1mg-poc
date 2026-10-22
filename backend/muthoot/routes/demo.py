"""Demo start page: the LOS customers and a new PD link for one of them."""
import threading

from flask import jsonify

from ..errors import ApiError
from ..services.links import email_link, issue_link, will_email
from ..services.los import load_customers
from ..services.videosdk import VideoSDKError
from . import bp, org_settings


def _masked(email: str) -> str:
    """j***@videosdk.live: shows where the link goes without the full address."""
    if "@" not in email:
        return ""
    name, domain = email.split("@", 1)
    return f"{name[:1]}***@{domain}"


@bp.route("/demo/customers", methods=["GET"])
def demo_customers():
    """Name, application ID, preferred language and a masked email; no LOS details."""
    return jsonify({
        "customers": [
            {
                "customer_id": customer_id,
                "name": customer["name"],
                "language_preference": customer["language_preference"],
                "email": _masked(customer.get("email", "")),
            }
            for customer_id, customer in load_customers(org_settings()).items()
        ]
    })


@bp.route("/demo/customers/<customer_id>/link", methods=["POST"])
def demo_link(customer_id):
    """A new link for one customer (the previous one stops working). The email is
    sent in the background, so the page doesn't wait for the mail server."""
    cfg = org_settings()
    try:
        issued = issue_link(cfg, customer_id)
    except VideoSDKError as error:
        raise ApiError(500, str(error))
    if issued is None:
        raise ApiError(404, f"No customer {customer_id} in the LOS tab.")
    customer, link = issued
    emailing = will_email(cfg, customer)
    if emailing:
        threading.Thread(target=email_link, args=(cfg, customer_id, customer, link), daemon=True).start()
    return jsonify({"link": link, "emailed_to": _masked(customer["email"]) if emailing else None})
