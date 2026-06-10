import { appParams, flowConfig } from "./appParams";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

// Single choke point for ALL calls to our backend. Flows with backend access
// disabled (PPMC) can never reach it — even from a call site missed in review.
const backendFetch = (path, options) => {
  if (!flowConfig.enableBackend) {
    throw new Error(`Backend calls are disabled in the "${appParams.flow}" flow: ${path}`);
  }
  return fetch(`${BACKEND_URL}${path}`, options);
};

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

// The participantId baked into tokens minted by the manual-join flow (getToken).
// Exposed so the join config can pass the SAME id the token was issued for.
export const getSessionParticipantId = () => _sessionParticipantId;

// Ensure image is a data URL before sending to AI APIs.
function ensureDataUrl(b64) {
  if (!b64 || b64.startsWith("data:")) return b64;
  return `data:image/jpeg;base64,${b64}`;
}

// ── Room / token APIs (proxied through our backend) ───────────────────────────

export const getToken = async ({ roomId, participantId } = {}) => {
  const role = appParams.role;
  const effectiveRoomId = roomId || _cachedRoomId;
  if (!effectiveRoomId) throw new Error("getToken: roomId is required");
  const body = {
    role,
    roomId: effectiveRoomId,
    participantId: participantId || _sessionParticipantId,
  };
  const res = await backendFetch(`/api/v1/video/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Participant-Role": role,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  return data.token;
};

export const getSessionCredentials = async ({ meetingId, mode }) => {
  const role = mode?.toUpperCase() === "DOCTOR" ? "DOCTOR" : "PATIENT";
  const res = await backendFetch(`/api/v1/video/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingId, role }),
  });
  if (!res.ok) throw new Error(`Session credentials request failed: ${res.status}`);
  const data = await res.json();
  return { token: data.token, participantId: data.participantId };
};

export const validateMeeting = async ({ roomId }) => {
  const res = await backendFetch(`/api/v1/video/meetings/${encodeURIComponent(roomId)}/validate`, {
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

// ── Identity verification APIs (proxied through our Flask backend) ────────────
// The backend holds the crawler token required for these VideoSDK AI endpoints.

export const isAiReady = () => true;

export const runOCR = async ({ frontBase64, backBase64 }) => {
  const res = await backendFetch(`/api/v1/identity/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frontPart: ensureDataUrl(frontBase64), backPart: ensureDataUrl(backBase64) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || body?.message || `OCR failed: ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
};

export const runFaceMatch = async ({ referenceBase64, targetBase64 }) => {
  const res = await backendFetch(`/api/v1/identity/face-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      img1: ensureDataUrl(referenceBase64),
      img2: ensureDataUrl(targetBase64),
    }),
  });
  if (!res.ok) throw new Error(`Face-match failed: ${res.status}`);
  return res.json();
};

export const runAntiSpoof = async ({ imageBase64 }) => {
  const res = await backendFetch(`/api/v1/identity/liveness`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ img: ensureDataUrl(imageBase64) }),
  });
  if (!res.ok) throw new Error(`Anti-spoof failed: ${res.status}`);
  return res.json();
};

export const maskAadhaarImage = async ({ imageBase64 }) => {
  const res = await backendFetch(`/api/v1/identity/aadhaar-mask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ img: ensureDataUrl(imageBase64) }),
  });
  if (!res.ok) throw new Error(`Aadhaar mask failed: ${res.status}`);
  return res.json();
};
