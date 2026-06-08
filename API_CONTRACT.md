# Tata 1mg — Video MER API Contract

**Scope:** VideoSDK frontend (VideoSDK team) ↔ Tata 1mg backend.
All backend implementation, asset storage, and third-party API calls are on Tata 1mg's side.

---

## 1. Session Launch

Tata 1mg generates both URLs and embeds credentials directly in them. The frontend reads everything from query params — no extra API call needed.

**Doctor URL**
```
https://<app-domain>/?meetingId=<roomId>&mode=DOCTOR&caseId=<caseId>&token=<doctorToken>&participantId=<participantId>&meetingTitle=<title>
```

**Patient URL**
```
https://<app-domain>/?meetingId=<roomId>&mode=PATIENT&caseId=<caseId>&token=<patientToken>&participantId=<participantId>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `meetingId` | string | ✓ | VideoSDK room ID |
| `mode` | `DOCTOR` \| `PATIENT` | ✓ | Role of the participant |
| `caseId` | string | ✓ | Tata 1mg case / consultation ID — attached to all submissions |
| `token` | string | ✓ | Pre-minted VideoSDK participant token |
| `participantId` | string | ✓ | Stable participant ID the token was issued for |
| `meetingTitle` | string | — | Optional label shown in the doctor's top bar |

> Tata 1mg is responsible for calling the VideoSDK Rooms API to create the room and minting role-scoped tokens for both participants before generating these URLs.

---

## 2. Asset Upload

Images are uploaded **as they are approved during the verification flow** — not batched at the end. Tata 1mg must expose an upload endpoint for this.

### Endpoint

```
POST /api/v1/mer/assets
Content-Type: multipart/form-data
```

### Form Fields

| Field | Type | Description |
|---|---|---|
| `caseId` | string | Tata 1mg case ID (same as URL param) |
| `sessionId` | string | VideoSDK `meetingId` |
| `assetType` | string | One of: `aadhaar_front`, `aadhaar_back`, `customer_photo` |
| `file` | binary (JPEG) | The image file |

### When each upload is triggered

| Asset | Trigger |
|---|---|
| `aadhaar_front` | Doctor clicks **Approve Document** in Step 2 (Identity Verification) |
| `aadhaar_back` | Doctor clicks **Approve Document** in Step 2 (Identity Verification) |
| `customer_photo` | Doctor clicks **Approve Photo** in Step 3 (Face Verification) |

> Both Aadhaar images are number-masked before upload — the full Aadhaar number is never sent. Only the last 4 digits are retained (`XXXX XXXX XXXX`).

### Expected Response

```json
{
  "assetId": "string"
}
```

The returned `assetId` is referenced in the final submission body.

---

## 3. Final Submission

Triggered when the doctor clicks **Submit to Tata 1mg** after completing all 3 verification steps. Sends structured metadata only — no image data in this call.

### Endpoint

```
POST /api/v1/mer/submit
Content-Type: application/json
```

### Request Body

```json
{
  "caseId": "string",
  "sessionId": "string",

  "geoData": {
    "latitude": 18.520430,
    "longitude": 73.856744,
    "accuracy": 15,
    "address": "Pune, Maharashtra, India"
  },

  "ocrData": {
    "name": "string",
    "dateOfBirth": "string",
    "gender": "string",
    "idNumber": "XXXX XXXX 4567",
    "address": "string"
  },

  "faceMatch": {
    "matched": true,
    "score": 0.94
  },

  "liveness": {
    "isReal": true,
    "confidence": 0.97
  },

  "assets": {
    "aadhaarFront": "<assetId from upload step>",
    "aadhaarBack": "<assetId from upload step>",
    "customerPhoto": "<assetId from upload step>"
  },

  "verifiedAt": "2026-06-07T10:30:00.000Z"
}
```

### Field Notes

| Field | Notes |
|---|---|
| `caseId` | Same ID passed in the launch URL |
| `sessionId` | VideoSDK `meetingId` |
| `geoData` | Collected from the **patient's** browser via GPS. `accuracy` is in metres. `address` is reverse-geocoded and may be absent. The entire object will be `null` if the patient denies location permission. |
| `ocrData` | Extracted by VideoSDK OCR from the Aadhaar front image. Any field may be absent if OCR did not detect it — treat all fields as optional. |
| `ocrData.idNumber` | Always masked. The full Aadhaar number is never transmitted. |
| `faceMatch.score` | Float 0–1 (1 = identical). May be absent if the AI check was skipped or failed. |
| `liveness.confidence` | Float 0–1. |
| `assets` | `assetId` values returned by the upload endpoint in step 2. |
| `verifiedAt` | ISO 8601 UTC timestamp of when the doctor submitted. |

### Expected Response

```json
{
  "success": true,
  "submissionId": "string"
}
```

---

## 4. Verification Step Summary

| Step | What Happens | Asset Uploaded |
|---|---|---|
| **Step 1 — Connection Details** | Patient's GPS location and device info collected. Doctor reviews and approves. | — |
| **Step 2 — Identity Verification** | Doctor captures Aadhaar front + back from patient's camera. OCR runs. Doctor approves. | `aadhaar_front`, `aadhaar_back` |
| **Step 3 — Face Verification** | Doctor captures patient's live photo. Liveness + face-match checks run. Doctor approves. | `customer_photo` |
| **Submit** | Doctor clicks Submit. Final JSON payload sent to Tata 1mg. | — |

---

## 5. Notes for Tata 1mg

- The frontend **never** stores or transmits the full Aadhaar number — masking is applied before any upload or display.
- If the patient denies location access, `geoData` will be `null` in the submission payload.
- OCR fields are provided as-is from the VideoSDK response — normalise or validate them on your side before persisting.
- The VideoSDK room and tokens must be created by Tata 1mg before generating the session URLs. The frontend does not call the VideoSDK room-creation API.
- Both `faceMatch` and `liveness` fields may be absent or incomplete if the AI service is unavailable — handle gracefully.
