from flask import jsonify

from . import bp


@bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})
