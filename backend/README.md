# Tata 1mg Video Consultation — Backend

Flask service that handles VideoSDK authentication for the doctor-patient video consultation flow.

**Responsibilities:**
- Issue RTC tokens scoped to a room + participant + role
- Create and validate VideoSDK rooms
- Issue short-lived AI tokens for client-side OCR / face-match / anti-spoof calls
- Enforce doctor-only access for room creation

AI calls (OCR, face-match, anti-spoof) happen directly from the browser using the AI token returned by this service. This backend never proxies those requests.

---

## Requirements

- Python 3.11+
- A [VideoSDK](https://videosdk.live) account with an API key and secret

---

## Local setup

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment variables
cp .env.example .env
# Edit .env and fill in VIDEOSDK_API_KEY and VIDEOSDK_SECRET

# 4. Run the dev server
python app.py
```

The server starts on `http://localhost:5000` by default. Set `PORT` in `.env` to change it.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VIDEOSDK_API_KEY` | Yes | Your VideoSDK API key |
| `VIDEOSDK_SECRET` | Yes | Your VideoSDK secret |
| `PORT` | No | Server port (default: `5000`) |
| `FLASK_DEBUG` | No | Set to `1` for hot-reload in local dev only |

---

## API

All endpoints are prefixed with `/api/video`.

### `POST /api/video/meetings`

Creates a new VideoSDK room. Requires the caller to identify as a doctor.

**Request headers:**
```
X-Participant-Role: DOCTOR
```

**Response:**
```json
{ "roomId": "abc-1234-xyz" }
```

---

### `POST /api/video/meetings/:roomId/validate`

Checks whether a room ID exists and is active.

**Response:**
```json
{ "valid": true }
```

---

### `POST /api/video/token`

Issues an RTC token for a given room and participant.

**Request body:**
```json
{
  "roomId": "abc-1234-xyz",
  "role": "DOCTOR",
  "participantId": "optional-custom-id"
}
```

**Response:**
```json
{
  "token": "<jwt>",
  "aiToken": "<jwt>"
}
```

---

### `POST /api/video/session-credentials`

Issues a token with a **deterministic** `participantId` derived from the role and meeting ID. Use this when you want the same identity preserved across page refreshes or re-joins.

**Request body:**
```json
{
  "meetingId": "abc-1234-xyz",
  "role": "PATIENT"
}
```

**Response:**
```json
{
  "token": "<jwt>",
  "participantId": "patient-abc-1234-xyz",
  "aiToken": "<jwt>"
}
```

---

### `GET /health`

Liveness check used by load balancers and uptime monitors.

**Response:**
```json
{ "status": "ok" }
```

---

## Role system

| Role value (case-insensitive) | Permissions |
|---|---|
| `DOCTOR` | `allow_join`, `allow_mod` (can mute/remove participants) |
| `PATIENT` / anything else | `allow_join` only |

Role can be sent either as an `X-Participant-Role` header or as a `"role"` field in the request body. The header takes precedence.

---

## Production notes

- **Never commit `.env`** — it contains your VideoSDK secret.
- Set `FLASK_DEBUG=0` in production (it is `0` by default).
- Run behind a WSGI server (Gunicorn, uWSGI) — do not use `python app.py` in production.
- Lock `ALLOWED_ORIGINS` in `app.py` to your actual frontend domain before deploying.

### Running with Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## Project structure

```
backend/
├── app.py            # All routes and token logic
├── requirements.txt  # Pinned dependencies
├── .env.example      # Environment variable template
└── README.md
```
