# Backend — Tata 1mg Video Consultation

Flask API for VideoSDK room/token management and identity verification.

## Setup

```bash
cp .env.example .env   # fill in VIDEOSDK_API_KEY and VIDEOSDK_SECRET
./start.sh             # creates venv, installs deps, starts server
```

## Environment

| Variable | Required |
|---|---|
| `VIDEOSDK_API_KEY` | Yes |
| `VIDEOSDK_SECRET` | Yes |
| `PORT` | No (default `5000`) |

## API

**Video**

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/video/meetings` | Create room — doctor only (`X-Participant-Role: DOCTOR`) |
| `POST` | `/api/v1/video/meetings/:id/validate` | Check if room is active |
| `POST` | `/api/v1/video/token` | RTC token for `{ roomId, role, participantId? }` |
| `POST` | `/api/v1/video/session` | RTC token + deterministic participantId for `{ meetingId, role }` |

**Identity**

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/identity/ocr` | ID document OCR |
| `POST` | `/api/v1/identity/face-verify` | Face comparison |
| `POST` | `/api/v1/identity/liveness` | Anti-spoof / liveness |
| `POST` | `/api/v1/identity/aadhaar-mask` | Mask Aadhaar number |

**Health:** `GET /health`

## Production

```bash
.venv/bin/gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

Never commit `.env`. Set `ALLOWED_ORIGINS` in `app.py` to your frontend domain.
