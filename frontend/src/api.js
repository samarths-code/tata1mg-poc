const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
const VIDEOSDK_AI = "https://api.videosdk.live/ai/v1";

// Stable participant ID for this browser session (used by the manual join flow).
const _sessionParticipantId = (() => {
  const KEY = "_vsdk_pid";
  const stored = sessionStorage.getItem(KEY);
  if (stored) return stored;
  const id = "p-" + Math.random().toString(36).slice(2, 10);
  sessionStorage.setItem(KEY, id);
  return id;
})();

// Last known meeting ID — fallback when React state hasn't propagated yet.
let _cachedRoomId = null;

// Short-lived crawler token issued by our backend for VideoSDK AI API calls.
// Populated whenever a token endpoint is called; AI functions use it automatically.
let _cachedAiToken = null;

export const isAiReady = () => !!_cachedAiToken;

// The participantId baked into tokens minted by the manual-join flow (getToken).
// Exposed so the join config can pass the SAME id the token was issued for.
export const getSessionParticipantId = () => _sessionParticipantId;

function getParticipantRole() {
  const mode = new URLSearchParams(window.location.search).get("mode")?.toUpperCase();
  return mode === "DOCTOR" ? "DOCTOR" : "CUSTOMER";
}

// Ensure image is a data URL before sending to VideoSDK AI APIs.
function ensureDataUrl(b64) {
  if (!b64 || b64.startsWith("data:")) return b64;
  return `data:image/jpeg;base64,${b64}`;
}

// ── Room / token APIs (proxied through our backend) ───────────────────────────

export const getToken = async ({ roomId, participantId } = {}) => {
  const role = getParticipantRole();
  const effectiveRoomId = roomId || _cachedRoomId;
  if (!effectiveRoomId) throw new Error("getToken: roomId is required");
  const body = {
    role,
    roomId: effectiveRoomId,
    participantId: participantId || _sessionParticipantId,
  };
  const res = await fetch(`${BACKEND_URL}/api/video/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Participant-Role": role,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  _cachedAiToken = data.aiToken;
  return data.token;
};

export const getSessionCredentials = async ({ meetingId, mode }) => {
  const role = mode?.toUpperCase() === "DOCTOR" ? "DOCTOR" : "PATIENT";
  const res = await fetch(`${BACKEND_URL}/api/video/session-credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingId, role }),
  });
  if (!res.ok) throw new Error(`Session credentials request failed: ${res.status}`);
  const data = await res.json();
  _cachedAiToken = data.aiToken;
  return { token: data.token, participantId: data.participantId };
};

export const createMeeting = async () => {
  const res = await fetch(`${BACKEND_URL}/api/video/meetings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Participant-Role": "DOCTOR",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Create meeting failed: ${res.status}`);
  }
  const { roomId } = await res.json();
  _cachedRoomId = roomId;
  return roomId;
};

export const validateMeeting = async ({ roomId }) => {
  const res = await fetch(`${BACKEND_URL}/api/video/meetings/${encodeURIComponent(roomId)}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (data.valid === true) _cachedRoomId = roomId;
  return data.valid === true;
};

export const getIPGeoInfo = async () => {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(tid);
    const d = await res.json();
    return {
      ip: d.ip,
      city: d.city,
      region: d.region,
      country: d.country_name,
      latitude: d.latitude,
      longitude: d.longitude,
      org: d.org,
      timezone: d.timezone,
    };
  } catch {
    return null;
  }
};

// ── VideoSDK AI APIs (called directly from the client) ────────────────────────
// Auth uses the short-lived aiToken issued by our backend alongside the RTC token.

export const runOCR = async ({ imageBase64 }) => {
  const img = ensureDataUrl(imageBase64);
  const res = await fetch(`${VIDEOSDK_AI}/ocr`, {
    method: "POST",
    headers: { Authorization: _cachedAiToken, "Content-Type": "application/json" },
    body: JSON.stringify({ frontPart: img, backPart: img }),
  });
  if (!res.ok) throw new Error(`OCR API ${res.status}`);
  return res.json();
};

export const runFaceMatch = async ({ referenceBase64, targetBase64 }) => {
  const res = await fetch(`${VIDEOSDK_AI}/face-verification/verify`, {
    method: "POST",
    headers: { Authorization: _cachedAiToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      img1: ensureDataUrl(referenceBase64),
      img2: ensureDataUrl(targetBase64),
    }),
  });
  if (!res.ok) throw new Error(`Face-match API ${res.status}`);
  return res.json();
};

export const runAntiSpoof = async ({ imageBase64 }) => {
  const res = await fetch(`${VIDEOSDK_AI}/face-verification/detect-spoof`, {
    method: "POST",
    headers: { Authorization: _cachedAiToken, "Content-Type": "application/json" },
    body: JSON.stringify({ img: ensureDataUrl(imageBase64) }),
  });
  if (!res.ok) throw new Error(`Anti-spoof API ${res.status}`);
  return res.json();
};

export const maskAadhaarImage = async ({ imageBase64 }) => {
  const res = await fetch(`${VIDEOSDK_AI}/aadhaar-mask`, {
    method: "POST",
    headers: { Authorization: _cachedAiToken, "Content-Type": "application/json" },
    body: JSON.stringify({ img: ensureDataUrl(imageBase64) }),
  });
  if (!res.ok) throw new Error(`Aadhaar mask API ${res.status}`);
  return res.json(); // { maskedImage: "data:image/jpeg;base64,..." }
};
