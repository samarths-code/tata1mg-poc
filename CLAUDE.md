# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Doctor–patient video consultation app for Tata 1mg MER (Medical Examination Report) flows, built on VideoSDK. Two independent apps in one repo:

- `frontend/` — React 18 (Create React App, JavaScript, Tailwind) using `@videosdk.live/react-sdk`
- `backend/` — Python Flask, a single file (`backend/app.py`) that proxies VideoSDK REST/AI APIs and mints tokens

`API_CONTRACT.md` defines the integration contract with Tata 1mg's side (session-launch URLs, asset upload, MER submission). Consult it before changing URL params or upload payloads.

## Commands

Frontend (run from `frontend/`):
```bash
npm install
npm start        # dev server on :3000; needs REACT_APP_BACKEND_URL (defaults to http://localhost:5001)
npm run build    # production build → frontend/build
```

Backend (run from `backend/`):
```bash
./start.sh       # creates .venv + installs requirements.txt on first run, starts Flask with FLASK_DEBUG=1
                 # requires VIDEOSDK_API_KEY and VIDEOSDK_SECRET in backend/.env; PORT defaults to 5000
```

Production: `pm2 start ecosystem.config.js` (repo root) runs the backend on port 5001; frontend deploys to Vercel as a static SPA (`vercel.json` rewrites everything to index.html).

There is no test suite and no linter beyond CRA's built-in ESLint config.

## Architecture

### No router, URL-param driven

`frontend/src/App.js` (`AppRouter`) does plain `window.location` dispatch: `/create-meeting` and `/thank-you` are the only paths; everything else requires `?meetingId=...&mode=DOCTOR|PATIENT` query params or falls back to the create-meeting page. There is no login — identity comes entirely from query params (`token`, `participantId`, `caseId`, `meetingTitle`). If a `token` is in the URL, the backend credentials call is skipped (pre-auth flow); otherwise `App` fetches `POST /api/v1/video/session` for a token + deterministic participantId.

Note: URL `mode=PATIENT` is mapped to the internal mode `CUSTOMER` (`participantModes` in `utils/common.js`).

### Global state: zustand store behind a Context-shaped shim

`frontend/src/store/meetingStore.js` is the single global store. `useMeetingAppContext(selector)` — re-exported through `frontend/src/context/MeetingAppContext.js` — is the access hook used by ~30 components. It is selector-aware:

- `useMeetingAppContext(s => s.customerPhoto)` — preferred; subscribes to one slice
- `useMeetingAppContext()` with no args returns the whole store and re-renders on every change — legacy only, don't write new code this way

`MeetingAppProvider` holds no state; it only seeds the store from props once before first render. The store also owns the singleton `VirtualBackgroundProcessor`.

### Backend token model (`backend/app.py`)

Three token types, do not mix them up:
- **Management token** — server-side only for VideoSDK REST calls; must never reach the client
- **RTC token** (`build_rtc_token`) — per-participant, role-scoped (`DOCTOR`/`CUSTOMER`), returned by `/api/v1/video/token` and `/api/v1/video/session`
- **Crawler token** (`build_crawler_token`) — short-lived, scoped for client-side VideoSDK AI API calls

Room creation (`POST /api/v1/video/meetings`) is doctor-only, enforced via the `X-Participant-Role: DOCTOR` header. The `/api/v1/identity/*` endpoints (OCR, face-verify, liveness, aadhaar-mask) proxy VideoSDK AI APIs. All frontend → backend calls live in `frontend/src/api.js`.

### Meeting UI and the MER verification flow

- `frontend/src/meeting/MeetingContainer.js` — top-level in-call layout, wraps everything in VideoSDK's `MeetingProvider`
- `frontend/src/components/doctor/` — doctor-side verification flow (DoctorView, VerificationDrawer, CaptureOverlay): the doctor captures the patient's Aadhaar and photo, runs OCR/face-match/liveness via the identity endpoints, approves assets (uploaded per-approval, not batched — see API_CONTRACT.md), and generates the MER PDF (`utils/generateMERpdf.js`)
- `frontend/src/components/screens/` — pre/post-call screens (JoiningScreen, WaitingToJoinScreen, LeaveScreen)
- In `App.js`, JoiningScreen stays mounted (pointer-events-none) after the meeting starts — intentional, for WaitingToJoinScreen's backdrop blur

## Knowledge graph

A graphify graph of this codebase lives in `graphify-out/`. For cross-module questions, prefer `graphify query "<question>"` / `graphify path "<A>" "<B>"` over grep, and read `graphify-out/GRAPH_REPORT.md` for the hub abstractions (`useMeetingAppContext` is the biggest by far). After modifying code, run `graphify update .` to keep it current.
