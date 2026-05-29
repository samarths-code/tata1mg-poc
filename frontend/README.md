# Tata 1mg Video MER — Frontend

React (CRA) frontend for the Medical Examination Report (MER) video consultation flow, built on VideoSDK.

## Prerequisites

- Node.js 16+
- npm or yarn
- A VideoSDK account — get a token from [app.videosdk.live](https://app.videosdk.live)

## Setup

**1. Install dependencies**

```bash
cd frontend
npm install
```

**2. Configure environment variables**

Copy `.env` and fill in your values:

```bash
cp .env .env.local
```

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_VIDEOSDK_TOKEN` | Yes (for local dev) | VideoSDK auth token — only needed when not passing `?token=` in the URL |
| `REACT_APP_TATA1MG_API_URL` | No | Tata 1mg backend base URL (default: `https://api.tata1mg.com`) |
| `REACT_APP_RECORDING_TEMPLATE_URL` | No | Recording template URL — omit to disable auto-recording |

**3. Start the dev server**

```bash
npm start
```

App opens at `http://localhost:3000`.

## URL Parameters

The app is driven entirely by URL query params — no login screen.

| Param | Values | Description |
|---|---|---|
| `mode` | `DOCTOR` / `CUSTOMER` / `AGENT` | Role of the participant |
| `meetingId` | room ID string | Join an existing meeting (skip if doctor is creating one) |
| `token` | VideoSDK JWT | Auth token — overrides `REACT_APP_VIDEOSDK_TOKEN` |
| `caseId` | string | MER case ID used when submitting documents |
| `appId` | string | VideoSDK App ID — auto-fetches a token if `token` is not set |

### Example URLs

**Doctor (creates a meeting):**
```
http://localhost:3000/?mode=DOCTOR&token=YOUR_TOKEN&caseId=CASE_123
```

**Customer (joins an existing meeting):**
```
http://localhost:3000/?mode=CUSTOMER&token=YOUR_TOKEN&meetingId=ROOM_ID&caseId=CASE_123
```

## Scripts

```bash
npm start       # Start dev server on port 3000
npm run build   # Production build → ./build
npm test        # Run tests
```

## Doctor Flow (5 steps)

1. **Greeting** — greet the customer on camera
2. **Details + Reference Face** — capture a reference photo for face-match
3. **Photo + Face Match** — capture customer photo, run VideoSDK face verification
4. **Aadhaar + OCR** — capture Aadhaar card, run VideoSDK OCR
5. **Submit** — POST all documents to the Tata 1mg backend

## External APIs Used

| API | Endpoint |
|---|---|
| Create/validate room | `https://api.videosdk.live/v2/rooms` |
| OCR | `https://api.videosdk.live/ai/v1/ocr` |
| Face match | `https://api.videosdk.live/ai/v1/face-verification/verify` |
| Anti-spoof | `https://api.videosdk.live/ai/v1/face-verification/detect-spoof` |
| Submit documents | `REACT_APP_TATA1MG_API_URL/api/mer/cases/:caseId/documents` |

## Project Structure

```
src/
  api.js              # All API calls (VideoSDK + Tata 1mg)
  App.js              # Root component, token + meeting state
  context/            # MeetingAppContext (shared state)
  components/
    screens/          # JoiningScreen, LeaveScreen
  meeting/            # MeetingContainer and in-call UI
  hooks/              # Custom React hooks
  utils/              # Helpers
```
