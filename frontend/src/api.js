const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

// Which client this build belongs to. The backend signs every token and makes
// every VideoSDK call with this org's API key + secret (see backend/orgs.json).
// Unset -> the backend's default (.env) credentials.
const ORG_ID = process.env.REACT_APP_ORG_ID || "";

const backendHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  ...(ORG_ID ? { "X-Org-Id": ORG_ID } : {}),
  ...extra,
});

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

function getParticipantRole() {
  const mode = new URLSearchParams(window.location.search).get("mode")?.toUpperCase();
  return mode === "DOCTOR" ? "DOCTOR" : "CUSTOMER";
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
  const res = await fetch(`${BACKEND_URL}/api/v1/video/token`, {
    method: "POST",
    headers: backendHeaders({ "X-Participant-Role": role }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  return data.token;
};

export const getSessionCredentials = async ({ meetingId, mode }) => {
  const role = mode?.toUpperCase() === "DOCTOR" ? "DOCTOR" : "PATIENT";
  const res = await fetch(`${BACKEND_URL}/api/v1/video/session`, {
    method: "POST",
    headers: backendHeaders(),
    body: JSON.stringify({ meetingId, role }),
  });
  if (!res.ok) throw new Error(`Session credentials request failed: ${res.status}`);
  const data = await res.json();
  return { token: data.token, participantId: data.participantId };
};

export const createMeeting = async () => {
  const res = await fetch(`${BACKEND_URL}/api/v1/video/meetings`, {
    method: "POST",
    headers: backendHeaders({ "X-Participant-Role": "DOCTOR" }),
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

// Creates a room and pre-generates tokens for both roles in one call.
// Used by CreateMeetingPage to embed tokens directly in the shareable URLs.
export const createMeetingWithCredentials = async () => {
  const roomId = await createMeeting();
  const [doctorCreds, patientCreds] = await Promise.all([
    getSessionCredentials({ meetingId: roomId, mode: "DOCTOR" }),
    getSessionCredentials({ meetingId: roomId, mode: "PATIENT" }),
  ]);
  return {
    roomId,
    doctor: { token: doctorCreds.token, participantId: doctorCreds.participantId },
    patient: { token: patientCreds.token, participantId: patientCreds.participantId },
  };
};

export const validateMeeting = async ({ roomId }) => {
  const res = await fetch(`${BACKEND_URL}/api/v1/video/meetings/${encodeURIComponent(roomId)}/validate`, {
    method: "POST",
    headers: backendHeaders(),
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
