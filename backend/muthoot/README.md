# Muthoot Finance — AI Video PD (`backend/muthoot`)

The backend of the Muthoot AI Video PD demo, moved from its separate FastAPI service into a
Flask blueprint on this multi-org backend (the FastAPI service is no longer needed). Every route is under
**`/api/v1/muthoot`** and uses the **`muthoot` org's** VideoSDK API key and secret
from `orgs.json` (admin page).

The other two parts of the demo live elsewhere:

- **Customer page** (React): set `REACT_APP_BACKEND_URL=https://<this backend>/api/v1/muthoot`.
- **AI agent** (Zero Runtime Cloud): set `BACKEND_URL=https://<this backend>/api/v1/muthoot`
  in its `deploy.env`.

## Layout

```
muthoot/
  __init__.py      bp + start_event_writer() (used by app.py)
  config.py        MUTHOOT_* settings from backend/.env
  errors.py        ApiError -> {"detail": ...}
  routes/          thin Flask handlers, one blueprint under /api/v1/muthoot
    demo.py  sessions.py  verify.py  results.py  events.py  health.py  validation.py
  services/        the logic
    sheet.py  los.py  links.py  mailer.py  videosdk.py  sessions.py
    face.py  reference_photo.py  selfie.py  results.py  results_sheet.py  journey_events.py
  assets/          email logo
  models/          face model (downloaded on first use, gitignored)
  photos/          local reference photos (gitignored)
  data/            written files (gitignored)
```

## Routes

| Method | Path (under `/api/v1/muthoot`) | Called by | Purpose |
|---|---|---|---|
| `GET` | `/demo/customers` | page (start page) | LOS customers: name, ID, language, masked email |
| `POST` | `/demo/customers/<id>/link` | page (start page) | New signed PD link for one customer, saved to the LOS tab, emailed in the background |
| `POST` | `/sessions/from-link` | page | `{pd}` from the link: checks signature, newest link, expiry, selfie pause → room + token |
| `POST` | `/sessions/<room_id>/consents` | page | The 4 consents + location; then the agent is dispatched |
| `POST` | `/verify/face` | page | `{image}` → `{faces}` for the live camera checks |
| `POST` | `/verify/selfie` | page | `{room_id, capture_id, image}` → face count + VideoSDK Face Match |
| `GET` | `/verify/selfie/<room_id>/<capture_id>` | agent | That selfie's result (404 until it arrives) |
| `POST` | `/results` | agent | The finished PD → one row in the Results tab |
| `POST` | `/events` | agent, page | A journey event → `data/journey_events.jsonl` and the Events tab (every 10 s) |
| `GET` | `/health` | — | `{"status": "ok"}` |

Errors are `{"detail": ...}`, as the customer page expects.

## Setup

1. **Org:** on the admin page add org **`muthoot`** with the VideoSDK API key and
   secret of the account the Zero Runtime agent runs on, and the customer page's
   origin under *Frontend origins* (for CORS).
2. **`.env`:** fill in the `MUTHOOT_*` keys (see `.env.example`). The Google
   service account key file is referenced by path and never committed.
3. **Sheet:** share the Google Sheet (tabs `LOS`, `Results`, `Events`) with the
   service account as Editor.
4. **Install:** `pip install -r requirements.txt` (adds `gspread` and `mediapipe`;
   the face model is downloaded to `muthoot/models/` on first use).

## Run as one process

Video PD sessions (room → customer, consents, selfie results) are kept **in
memory**. Run **one** gunicorn worker with threads, e.g.

```bash
.venv/bin/gunicorn -w 1 --threads 8 -b 0.0.0.0:6001 backend.app:app
```

Several workers (`-w 4`) would split the sessions between processes, and a PD
would fail when a request lands on the wrong one. Threads are needed because a
selfie check (Face Match, up to 30 s) must not block the camera checks.

## Files written

`muthoot/data/` (gitignored, or `MUTHOOT_DATA_DIR`): `journey_events.jsonl`,
`selfies/<room>_<attempt>.jpg` (for the auditor) and `results_not_in_sheet.jsonl`
(results that couldn't reach the sheet). Local reference photos go in
`muthoot/photos/` (gitignored), or use the Drive folder `MUTHOOT_GOOGLE_PHOTOS_FOLDER_ID`.
