# Frontend — Tata 1mg Video Consultation

React app for the doctor-patient MER video consultation flow, built on VideoSDK.

## Setup

```bash
npm install
cp .env .env.local   # fill in REACT_APP_BACKEND_URL
npm start            # runs on http://localhost:3000
```

## Environment

| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | Backend base URL (default `http://localhost:5001`) |

## URL Parameters

The app is driven by query params — no login screen.

| Param | Description |
|---|---|
| `meetingId` | Room ID to join |
| `mode` | `DOCTOR` or `PATIENT` |
| `participantId` | Pre-set participant identity |
| `token` | Pre-generated RTC token (from create-meeting page) |
| `meetingTitle` | Displayed on the joining screen |
| `caseId` | MER case ID |

## Scripts

```bash
npm start        # dev server
npm run build    # production build → ./build
```
