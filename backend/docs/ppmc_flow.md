 PPMC Flow — Bulk Links, Admit Flow, Auto-Recording, Google Sheet Sync
  
 Context

 PPMC (pre-policy medical check) video sessions for Tata 1mg, run by a non-technical ops team (Sunil/PPMC Ops). Requirements from the requirement sheet (due 13 Jun 2026):

 1. P0 — Bulk link creation: prompt for date + N sessions → create N meetings, generate doctor + patient links, append rows to the Google Sheet for that date.
 2. P1 — Doctor admits patient: patient joins via ask_join so they can't start/restart a session alone by reusing the link.
 3. P1 — Disable link: doctor popup to permanently invalidate the meeting ID; sheet status updated.
 4. P0 — Auto-record start when BOTH doctor and patient have joined (backend-driven).
 5. P0 — Auto-record stop when both leave; recording URL written back to the matching sheet row.
 6. P3 — Recording download/deletion stays manual (Phase 2 automation).
 7. Open — whiteboard/screenshare: recommend screenshare doctor-only, no whiteboard (cheap to gate via flowConfig; confirm with ops).

 What already exists (less to build than the sheet implies):
 - frontend/src/appParams.js already defines flow=ppmc with { showSidebar: false, enableBackend: false, enableVerification: false } — the "remove MER sidebar" requirement is done. PPMC links must carry a pre-minted token + participantId in
 the URL (no backend credentials call).
 - backend/app.py already has /webhooks/videosdk scaffolding (recording-started/stopped/failed cases) and a vsdk_post/vsdk_get helper layer with management-token auth.
 - build_rtc_token mints role-scoped tokens but hardcodes 30-min expiry and always allow_join — both need PPMC variants.

 Verified VideoSDK APIs (docs.videosdk.live):
 - POST /v2/rooms — accepts top-level webhook: { endPoint, events: [...] } (exact names or regex like participant-*), independent of autoStartConfig. PPMC rooms use webhook only — no autoStartConfig (MER's auto-start-on-session-start is
 wrong for "start when both joined").
 - POST /v2/rooms/deactivate {roomId} — permanently disables the room ("disabled": true); join attempts fail afterward.
 - POST /v2/recordings/start {roomId, config?, webhookUrl?} and POST /v2/recordings/stop {roomId}.
 - GET /v2/sessions?roomId=<id> — active session + participant list (used for stateless "both joined / both left" checks).
 - Webhooks: participant-joined / participant-left (carry participantId), session-started / session-ended, recording-stopped (carries fileUrl).
 - React SDK: token permission ask_join → patient's join() raises onEntryRequested on the host (doctor) with {participantId, name, allow(), deny()}; patient gets onEntryResponded.

 Decision: Apps Script, not a local script

 Ops is non-technical — they should never touch a terminal, Node, or Python. A container-bound Apps Script on the PPMC Google Sheet adds a custom menu (PPMC → Generate links): a dialog asks for date + number of sessions, calls the Flask
 backend, and appends rows. The script holds no VideoSDK secrets — only a backend shared key in Script Properties. A local script would also require distributing credentials to every ops laptop; rejected.

 Architecture

 Ops (Google Sheet) ──menu──▶ Apps Script ──POST /api/v1/ppmc/sessions/bulk──▶ Flask backend
                                   │                                              │ creates N rooms (webhook-only config)
                                   ◀── rows: meetingId, doctor/patient links ─────┘ mints tokens, builds links
                                   └─ appends rows to sheet (script is already in the sheet)

 VideoSDK ──webhooks (participant-joined/left, session-ended, recording-stopped)──▶ Flask /webhooks/videosdk
    Flask: both roles present → /v2/recordings/start · both gone → /v2/recordings/stop
    Flask ──writeback (recording URL, status)──▶ Google Sheet  [Option A or B below]

 Doctor UI ──"Disable link" popup──▶ Flask /api/v1/video/meetings/<id>/disable ──▶ /v2/rooms/deactivate + sheet status

 Sheet columns: Date | Meeting ID | Doctor Link | Patient Link | Status | Recording URL | Notes
 Status lifecycle: CREATED → IN_SESSION → COMPLETED (recording URL written) or DISABLED.

 Role identification without extra metadata: the bulk endpoint mints deterministic participant IDs — doctor-<roomId> / patient-<roomId> (same convention as the existing /api/v1/video/session). Webhook participant-joined payloads carry
 participantId, so the backend derives the role from the prefix. No custom frontend metaData needed for the recording trigger.

 Changes

 1. Backend — backend/app.py (+ new backend/sheet_sync.py)

 POST /api/v1/ppmc/sessions/bulk (new) — auth via X-PPMC-Key header checked against PPMC_SHARED_KEY env var. Body {date: "2026-06-13", count: N} (cap N, e.g. ≤ 50). For each session:
 - vsdk_post("/v2/rooms", {"webhook": {"endPoint": WEBHOOK_URL, "events": ["participant-joined", "participant-left", "session-ended", "recording-*"]}}) — no autoStartConfig.
 - Mint tokens via a generalized build_rtc_token(..., expires_at=..., permissions=...):
   - doctor: ["allow_join", "allow_mod"], participantId = doctor-<roomId>
   - patient: ["ask_join"], participantId = patient-<roomId>
   - expiry: end of the scheduled date + 6h grace (IST), not 30 min — links are created days ahead and embedded in the URL.
 - Build links from FRONTEND_BASE_URL env: /?meetingId=<id>&mode=DOCTOR|PATIENT&flow=ppmc&token=<jwt>&participantId=<pid>
 - Return [{meetingId, doctorLink, patientLink}, ...].

 Webhook orchestration (extend existing /webhooks/videosdk) — stateless, survives Flask restarts:
 - participant-joined: if participantId matches doctor-*/patient-*, GET /v2/sessions?roomId= and check the active session's participant list. If both role prefixes present → POST /v2/recordings/start {roomId}. Treat "already recording"
 errors as success (idempotent re-entry).
 - participant-left: re-fetch session; if neither doctor nor patient remains → POST /v2/recordings/stop {roomId} (VideoSDK also auto-stops on session end; this is the explicit guarantee). Keep a tiny in-memory recording_started set purely
 as a fast-path guard, but never rely on it for correctness.
 - session-started: sheet status → IN_SESSION.
 - recording-stopped: extract fileUrl → sheet writeback: Recording URL + status COMPLETED.
 - Keep the existing recording-failed → end-session handler.

 POST /api/v1/video/meetings/<room_id>/disable (new) — requires X-Participant-Role: DOCTOR (reuse require_doctor()), sanitize_id. Calls /v2/rooms/deactivate {roomId} → sheet status DISABLED. Returns {disabled: true}.

 backend/sheet_sync.py (new) — one interface, two interchangeable implementations selected by env var SHEET_SYNC_MODE=gcp|appscript:

 def update_row(meeting_id: str, *, status: str = None, recording_url: str = None): ...

 Option A — GCP service account + gspread (SHEET_SYNC_MODE=gcp)

 - One-time setup (you, not ops): GCP project → enable Google Sheets API → create service account → download JSON key → share the PPMC sheet with the service-account email as Editor.
 - Env: GOOGLE_SERVICE_ACCOUNT_FILE=/path/key.json, PPMC_SHEET_ID, PPMC_SHEET_TAB.
 - Implementation: gspread — open by key, find(meeting_id, in_column=MEETING_ID_COL), update Status / Recording URL cells. Add gspread + google-auth to backend/requirements.txt.
 - Pros: direct API, no extra deployment, proper error responses, fast. Cons: GCP console setup + a key file to protect on the server.

 Option B — Apps Script web app (SHEET_SYNC_MODE=appscript)

 - The same bound script also exposes doPost(e): parse {secret, meetingId, status?, recordingUrl?}, verify secret against Script Properties, locate the row by Meeting ID, update cells, return JSON.
 - Deploy as Web App: Execute as: Me, Access: Anyone (guarded by the shared secret). Env on Flask: APPSCRIPT_WEBAPP_URL, APPSCRIPT_SECRET.
 - Pros: zero GCP, everything lives with the sheet, no key file. Cons: the /exec URL is publicly reachable (secret-only auth), redeploys can rotate the URL unless you use versioned deployments + "Manage deployments → Edit", error reporting
 is opaque, ~1–3 s latency.
 - Recommendation: ship with B if you want zero GCP setup this week; switch to A for production hardening. The sheet_sync.py interface makes the swap a config change.

 2. Apps Script — apps-script/ppmc.gs (new, checked into repo as the source of truth; pasted into the sheet's bound editor)

 - onOpen() → custom menu PPMC → Generate links….
 - Dialog (HTML service or ui.prompt): date (default today) + number of sessions.
 - UrlFetchApp.fetch(BACKEND_URL + "/api/v1/ppmc/sessions/bulk", {headers: {"X-PPMC-Key": prop}, payload: {date, count}}).
 - Append one row per session: date, meetingId, doctor link, patient link, status CREATED.
 - Config (backend URL, shared key, web-app secret for Option B) in Script Properties, never in code.
 - If Option B: same file contains doPost(e) for the writeback web app.

 3. Frontend — PPMC UI additions

 - Patient waiting lobby (ask_join): in frontend/src/meeting/MeetingContainer.js / a new screen component, when PPMC patient calls join(), show "Waiting for the doctor to admit you…" until onEntryResponded allows; on deny show a polite
 rejection screen. (WaitingToJoinScreen already exists in components/screens/ — extend/reuse its pattern.)
 - Doctor admit dialog: useMeeting({ onEntryRequested }) in the doctor's PPMC view → modal "Patient <name> wants to join — Admit / Deny" wired to the provided allow()/deny().
 - Disable-link popup (doctor, PPMC only): button in the doctor's controls/leave flow → confirm dialog "Permanently disable this meeting link?" → new disableMeeting(meetingId) in frontend/src/api.js → POST
 /api/v1/video/meetings/<id>/disable with the DOCTOR role header. Note: PPMC currently has enableBackend: false — that flag gates the credentials call; add a separate flowConfig flag (e.g. enableDisableLink: true for PPMC) rather than
 overloading enableBackend.
 - flowConfig gates in frontend/src/appParams.js: add screenShare: "doctor" | "both" | "none" and whiteboard: boolean per flow; PPMC default screenShare: "doctor", whiteboard: false (confirm with ops).

 4. Ops workflow (what Sunil's team actually does)

 1. Open the PPMC sheet → PPMC → Generate links… → enter date + count → rows appear.
 2. Share patient/doctor links (WhatsApp/SMS — outside this system).
 3. Doctor opens link → joins; patient opens link → "asks to join" → doctor admits.
 4. Recording starts itself when both are in; stops when both leave; the sheet row fills in the recording URL and COMPLETED automatically.
 5. If a link must be killed: doctor uses the in-call "Disable link" popup (or you expose a PPMC → Disable selected row menu item in Apps Script as an ops fallback — calls the same backend endpoint).
 6. Download/delete recordings manually from the URL in the sheet (Phase 2: automate).

 Critical files

 ┌───────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                           File                            │                                              Change                                               │
 ├───────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ backend/app.py                                            │ bulk endpoint, disable endpoint, webhook orchestration, build_rtc_token permissions/expiry params │
 ├───────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ backend/sheet_sync.py                                     │ new — sheet writeback, gcp/appscript dual implementation                                          │
 ├───────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ backend/requirements.txt                                  │ + gspread, google-auth (Option A)                                                                 │
 ├───────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ apps-script/ppmc.gs                                       │ new — menu, bulk dialog, (Option B) doPost writeback                                              │
 ├───────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ frontend/src/appParams.js                                 │ new flowConfig flags (screenshare/whiteboard/disable-link)                                        │
 ├───────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ frontend/src/api.js                                       │ disableMeeting()                                                                                  │
 ├───────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ frontend/src/meeting/MeetingContainer.js + new components │ admit dialog (doctor), waiting lobby (patient), disable popup                                     │
 └───────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────┘

 Out of scope / Phase 2

 - Automated recording download → 1mg storage → deletion from VideoSDK (the existing recording-stopped TODO in app.py).
 - Whiteboard (unless ops confirms a need).
 - Webhook signature verification (VideoSDK signs webhooks — worth adding when hardening; note in code TODO).

 Verification

 1. Run backend locally + ngrok http 5001; set VIDEOSDK_WEBHOOK_URL to the ngrok URL.
 2. Point a test copy of the sheet's Apps Script at the local backend; generate 2 sessions for today; confirm rows + working links (tokens decode with correct expiry/permissions/participantIds — check on jwt.io).
 3. Open doctor link in one browser, patient link in another: patient sees the waiting lobby; doctor gets the admit dialog; admit → both in call; confirm via backend logs that recordings/start fired only after the second join (test
 doctor-first and patient-first orderings).
 4. Both leave → recording-stopped webhook → sheet row gets Recording URL + COMPLETED. Test both writeback modes (SHEET_SYNC_MODE=gcp and appscript).
 5. Doctor disables a meeting → sheet shows DISABLED; reopening either link fails to join (room deactivated).
 6. Edge cases: patient refreshes during lobby (re-asks); doctor link reopened after disable; recording-failed path still ends the session.
