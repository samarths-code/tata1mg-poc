"""API errors for the Muthoot routes. Bodies are {"detail": ...} (the shape the
original FastAPI backend used), which the customer page reads."""
import time


class ApiError(Exception):
    def __init__(self, status: int, detail):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def not_yet(code: str, message: str, opens_at: float) -> ApiError:
    """403 for "come back later": the customer page shows a waiting screen with a
    countdown to opens_at and retries by itself. "now" lets it allow for a wrong
    clock on the customer's device."""
    return ApiError(403, {"code": code, "message": message, "opens_at": opens_at, "now": time.time()})
