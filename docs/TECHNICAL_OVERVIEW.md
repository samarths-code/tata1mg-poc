# VKYC Demo Overview

An engineering walkthrough of the video-KYC demo: a browser app where an **Agent** verifies a **Client's** identity on a live video call. Below is how each piece is put together.

## Architecture at a glance

- **Frontend** — React (CRA) single-page app, Tailwind for UI, Zustand for meeting state. Deployed as a static build on Vercel with an SPA rewrite to `index.html`.
- **Backend** — a thin Python **Flask** API. It holds the VideoSDK credentials, mints tokens, and proxies the VideoSDK REST + AI calls so secrets never reach the browser. CORS is env-driven.
- **VideoSDK** — provides the real-time video, room/recording infrastructure, and the AI identity checks.

The browser never talks to VideoSDK's key/secret directly — it only ever gets short-lived tokens and calls our own backend.

## How the video call works

The call is built on the VideoSDK React SDK. The app wraps the meeting in a provider, joins with a room id + token, and renders each participant's stream. Device setup (camera/mic selection, permissions, preview) happens before join, and in-call signaling (capture prompts, mic-state notices) rides over the SDK's pub/sub. It's a 1:1 Agent↔Client layout.

## Access & tokens

Everything is gated by short-lived JWTs the backend mints (HS256):

- **Join tokens** are scoped to a specific room and participant. The Agent gets moderator rights; the Client gets join-only.
- A separate **server-role token** is used for backend REST/AI calls and for the pre-call network test (the precall API won't accept a join token).

## Creating a session & sharing links

Creating a meeting spins up a VideoSDK room, then mints a token + participant id per role. The create page bakes those into two shareable links — an **Agent Link** and a **Client Link** — each carrying `meetingId`, `mode`, `token`, and `participantId`. Anyone with a link joins directly, no login.

## Joining & the pre-call step

On opening a link, the app runs a pre-call flow: permission checks (camera, mic, speaker, location), device selection, a live camera preview, and a **network-quality test** that scores the connection before joining. Links with a token join straight away; links with only a role fetch their credentials on open.

## The identity-verification pipeline

This is the core of the demo. During the call the Agent captures the Client's ID and a live selfie, and the backend runs each image through VideoSDK's AI identity APIs:

1. **OCR** — read the ID document (front/back) into structured fields.
2. **Face match** — compare the ID photo against the live selfie.
3. **Liveness / anti-spoof** — confirm it's a real person, not a photo or replay.
4. **Aadhaar masking** — automatically mask the ID number in the image.

Results feed the Agent's review drawer, and a **verification report PDF** is generated (jsPDF) with the match outcome.

## Recording & compliance

Rooms are created with automatic recording enabled. VideoSDK posts lifecycle events (`session-started/ended`, `recording-started/stopped/failed`) to our webhook endpoint; we handle them off the request thread and fetch the final recording URL when it's ready.

## Leave & rejoin

On leave, the app preserves the join params in the URL. The Thank You screen's **REJOIN** re-enters the *same* session in-app (no page reload) — it restores the token/participant, acquires fresh media tracks, and drops the user straight back into the call.

## The API exposed by videosdk

All served by the Flask backend, JSON in/out.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/video/meetings` | Create a video room. |
| `POST` | `/api/v1/video/meetings/<id>/validate` | Validate a room id. |
| `POST` | `/api/v1/video/session` | Issue a join token + participant id for a role. |
| `POST` | `/api/v1/video/token` | Issue an RTC join token. |
| `POST` / `GET` | `/api/v1/video/precall-token` | Token for the pre-call network test. |
| `POST` | `/api/v1/identity/ocr` | Read an ID document into fields. |
| `POST` | `/api/v1/identity/face-verify` | Match ID photo to live selfie. |
| `POST` | `/api/v1/identity/liveness` | Liveness / anti-spoof check. |
| `POST` | `/api/v1/identity/aadhaar-mask` | Mask the Aadhaar number in an image. |
| `POST` | `/webhooks/videosdk` | Receive session/recording events. |
| `GET`  | `/health` | Health check. |
