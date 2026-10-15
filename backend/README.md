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

## Multiple organisations (clients)

One backend serves every client. Each client's VideoSDK API key, secret and
create-meeting config live in **`orgs.json`** (gitignored; see
`orgs.example.json`), managed from the admin page.

1. Set `ADMIN_PATH` (12+ random chars), `ADMIN_USERNAME` and `ADMIN_PASSWORD`
   in `.env`, restart, and open **`/<ADMIN_PATH>/`**. Without all three the
   admin page doesn't exist (404).
2. Add an org: Org ID (e.g. `eureka-forbes`), API key, secret, optional
   webhook URL, and the create-meeting config. Presets: **Standard** (no
   recording), **Recording only**, and **Recording + post transcription &
   summary** (transcript and summary generated after the call). Keys are verified with VideoSDK
   on save; edits apply to the next request without a restart.
3. Build that client's frontend with `REACT_APP_ORG_ID=<org id>`.

Every request carries the org (`X-Org-Id` header, or `orgId` in the body or
query string). Tokens, room creation, validation, AI calls and webhook
follow-ups all use that org's credentials. Room webhooks are tagged with
`?orgId=` so recording lookups use the right key. Requests with no org use
`VIDEOSDK_API_KEY` / `VIDEOSDK_SECRET` from `.env` (the `default` org).

With several gunicorn workers, all of them read the same `orgs.json`, so keep
it on a disk every worker can see (`ORGS_FILE` to relocate it).

## Production

```bash
.venv/bin/gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

Never commit `.env`. Set `ALLOWED_ORIGINS` in `app.py` to your frontend domain.
