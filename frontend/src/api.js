const API_BASE_URL = "https://api.videosdk.live";
const TATA1MG_API_URL = process.env.REACT_APP_TATA1MG_API_URL || "https://api.tata1mg.com";
const VIDEOSDK_TOKEN = process.env.REACT_APP_VIDEOSDK_TOKEN;
const RECORDING_TEMPLATE_URL = process.env.REACT_APP_RECORDING_TEMPLATE_URL || "";

const stripDataUrl = (s) => (s || "").replace(/^data:image\/[a-z+]+;base64,/, "");

// Token is embedded in the join link by Tata 1mg backend.
// Fall back to env var for local dev/testing.
export const getToken = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get("token");
  if (urlToken) return urlToken;

  const appId = urlParams.get("appId");
  if (appId) {
    const url = `${API_BASE_URL}/v2/projects/auth-token/${appId}`;
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: ["allow_join"],
        expiresIn: "7d",
        roles: ["CRAWLER"],
      }),
    };
    const { authToken: token } = await fetch(url, options)
      .then((r) => r.json())
      .catch((e) => console.error("error in auth token", e));
    return token;
  }

  if (VIDEOSDK_TOKEN) return VIDEOSDK_TOKEN;
  console.error("No token available — add ?token= to the URL or set REACT_APP_VIDEOSDK_TOKEN");
};

export const createMeeting = async ({ token }) => {
  const url = `${API_BASE_URL}/v2/rooms`;
  const body = {};
  if (RECORDING_TEMPLATE_URL) {
    body.autoStartConfig = {
      recording: {
        config: {
          layout: { type: "SPOTLIGHT", priority: "SPEAKER", gridSize: 20 },
          theme: "DARK",
          mode: "video-and-audio",
          quality: "high",
          orientation: "landscape",
        },
        template: {
          url: RECORDING_TEMPLATE_URL,
          width: 1280,
          height: 720,
          windowWidth: 1280,
          windowHeight: 720,
        },
      },
    };
  }
  const options = {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const { roomId } = await fetch(url, options)
    .then((r) => r.json())
    .catch((e) => console.error("error in create room", e));
  return roomId;
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

export const validateMeeting = async ({ roomId, token }) => {
  const url = `${API_BASE_URL}/v2/rooms/validate/${roomId}`;
  const options = {
    method: "GET",
    headers: { Authorization: token, "Content-Type": "application/json" },
  };
  const result = await fetch(url, options)
    .then((r) => r.json())
    .catch((e) => console.error("error in validate room", e));
  return result ? result.roomId === roomId : false;
};

// ─── VideoSDK AI / Identity-Verification APIs ────────────────────────────────
// All three endpoints require a full `data:image/jpeg;base64,...` string.

const AI_BASE = "https://api.videosdk.live/ai/v1";

const ensureDataUrl = (s) =>
  s && s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`;

export const runOCR = async ({ token, imageBase64 }) => {
  const img = ensureDataUrl(imageBase64);
  const res = await fetch(`${AI_BASE}/ocr`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    // backPart is sent as the same image when only one side is captured
    body: JSON.stringify({ frontPart: img, backPart: img }),
  });
  if (!res.ok) throw new Error(`OCR API ${res.status}`);
  return res.json(); // { idType, idNumber, name, dateOfBirth, address, gender, mobileNumber }
};

export const runFaceMatch = async ({ token, referenceBase64, targetBase64 }) => {
  const res = await fetch(`${AI_BASE}/face-verification/verify`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      img1: ensureDataUrl(referenceBase64),
      img2: ensureDataUrl(targetBase64),
    }),
  });
  if (!res.ok) throw new Error(`Face-match API ${res.status}`);
  return res.json(); // { verified: boolean }
};

export const runAntiSpoof = async ({ token, imageBase64 }) => {
  const res = await fetch(`${AI_BASE}/face-verification/detect-spoof`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ img: ensureDataUrl(imageBase64) }),
  });
  if (!res.ok) throw new Error(`Anti-spoof API ${res.status}`);
  return res.json(); // { spoof_detected: boolean, accuracy: number }
};

// POST all captured MER documents to Tata 1mg backend
export const submitDocuments = async ({
  caseId,
  geoData,
  customerPhotoBase64,
  aadhaarPhotoBase64,
  sessionId,
}) => {
  const url = `${TATA1MG_API_URL}/api/mer/cases/${caseId}/documents`;
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      geoData,
      customerPhoto: customerPhotoBase64,
      aadhaarPhoto: aadhaarPhotoBase64,
      sessionId,
    }),
  };
  return fetch(url, options)
    .then((r) => r.json())
    .catch((e) => {
      console.error("error submitting documents", e);
      throw e;
    });
};
