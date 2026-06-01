import { useEffect, useState } from "react";
import { getNetworkStats } from "@videosdk.live/react-sdk";
import { XMarkIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const STATUS = { IDLE: "idle", CHECKING: "checking", GRANTED: "granted", DENIED: "denied" };

// Lucide-style 16×16 stroke icons (currentColor inherits text-orange-450)
const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const VolumeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

function PermissionRow({ icon: Icon, label, detail, status }) {
  const isGranted = status === STATUS.GRANTED;
  const isChecking = status === STATUS.CHECKING;

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl border border-[rgba(0,0,0,0.05)]">
      <div className="bg-[rgba(255,111,97,0.1)] p-1.5 rounded-full shrink-0 text-orange-450">
        <Icon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black leading-5">{label}</p>
        <p className="text-xs text-[#919093] leading-4 mt-0.5">{detail}</p>
      </div>
      {isChecking ? (
        <span className="w-4 h-4 rounded-full border-2 border-orange-450 border-t-transparent animate-spin shrink-0" />
      ) : (
        <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap leading-4 ${
          isGranted
            ? "bg-[#dcfce7] text-[#16a34a]"
            : "bg-[#fee2e2] text-[#dc2626]"
        }`}>
          {isGranted ? "Access granted" : "REQUIRED"}
        </span>
      )}
    </div>
  );
}

function permissionErrMsg(errorName, isLocation = false) {
  if (!errorName) return null;
  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError")
    return isLocation
      ? "Location blocked. Click the lock icon in your address bar → Site settings → set Location to Allow."
      : "Blocked by browser. Click the lock icon in your address bar → Site settings → set to Allow.";
  if (errorName === "PositionUnavailable")
    return "Location unavailable. Ensure your device has GPS or network location enabled.";
  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError")
    return "No device found. Connect a camera / microphone and retry.";
  if (errorName === "NotReadableError" || errorName === "TrackStartError")
    return "Device in use by another app. Close Zoom, Teams, or other video apps and retry.";
  if (errorName === "timeout")
    return isLocation
      ? "Location timed out. Move to an area with better signal and retry."
      : "Device not responding. Reconnect it and retry.";
  return isLocation
    ? "Could not determine location. Check device settings and retry."
    : "Could not access device. Check it is connected and not blocked.";
}

export default function PermissionSetup({ onDone }) {
  const [camera,   setCamera]   = useState(STATUS.IDLE);
  const [mic,      setMic]      = useState(STATUS.IDLE);
  const [speaker,  setSpeaker]  = useState(STATUS.IDLE);
  const [location, setLocation] = useState(STATUS.IDLE);
  const [network,  setNetwork]  = useState(STATUS.IDLE);
  const [networkDetail,  setNetworkDetail]  = useState(null);
  const [locationDetail, setLocationDetail] = useState(null);
  const [cameraError,   setCameraError]   = useState(null);
  const [micError,      setMicError]      = useState(null);
  const [locationError, setLocationError] = useState(null);

  const criticalDone =
    camera   === STATUS.GRANTED &&
    mic      === STATUS.GRANTED &&
    location === STATUS.GRANTED;

  useEffect(() => {
    runChecks();
  }, []);

  async function runChecks() {
    const withTimeout = (promise, ms = 10000) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ms)
        ),
      ]);

    setCameraError(null);
    setCamera(STATUS.CHECKING);
    try {
      const stream = await withTimeout(navigator.mediaDevices.getUserMedia({ video: true }));
      stream.getTracks().forEach((t) => t.stop());
      setCamera(STATUS.GRANTED);
    } catch (err) {
      setCamera(STATUS.DENIED);
      setCameraError(err?.message === "timeout" ? "timeout" : (err?.name || "unknown"));
    }

    setMicError(null);
    setMic(STATUS.CHECKING);
    try {
      const stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: true }));
      stream.getTracks().forEach((t) => t.stop());
      setMic(STATUS.GRANTED);
      setSpeaker(STATUS.GRANTED);
    } catch (err) {
      setMic(STATUS.DENIED);
      setSpeaker(STATUS.DENIED);
      setMicError(err?.message === "timeout" ? "timeout" : (err?.name || "unknown"));
    }

    setLocationError(null);
    setLocation(STATUS.CHECKING);
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocationDetail(
              `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
            );
            resolve();
          },
          reject,
          { timeout: 10000 }
        );
      });
      setLocation(STATUS.GRANTED);
    } catch (err) {
      setLocation(STATUS.DENIED);
      const code = err?.code;
      setLocationError(
        code === 1 ? "NotAllowedError" :
        code === 2 ? "PositionUnavailable" :
        code === 3 ? "timeout" : "unknown"
      );
    }

    setNetwork(STATUS.CHECKING);
    try {
      const stats = await getNetworkStats({ timeoutDuration: 20000 });
      setNetworkDetail(`↓ ${stats.downloadSpeed} Mbps  ↑ ${stats.uploadSpeed} Mbps`);
      setNetwork(STATUS.GRANTED);
    } catch {
      setNetwork(STATUS.DENIED);
    }
  }

  const hasDenied = camera === STATUS.DENIED || mic === STATUS.DENIED || location === STATUS.DENIED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-[500px] rounded-3xl border border-[rgba(0,0,0,0.05)] shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex flex-col gap-2 p-5">
          <div className="flex items-center gap-2.5">
            <h2 className="flex-1 text-[18px] font-semibold text-black leading-[26px]">
              Before you begin
            </h2>
            <button
              onClick={onDone}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors text-[#919093] hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[#919093] leading-4">
            Please allow the following permissions to join your video consultation smoothly.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[rgba(0,0,0,0.05)]" />

        {/* Permission list */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <PermissionRow
            icon={CameraIcon}
            label="Camera"
            detail="Required for video consultation with the doctor."
            status={camera}
          />
          <PermissionRow
            icon={MicIcon}
            label="Microphone"
            detail="Required for clear voice communication during the call."
            status={mic}
          />
          <PermissionRow
            icon={VolumeIcon}
            label="Speaker / Sound"
            detail="Required to hear the doctor clearly during the consultation."
            status={speaker}
          />
          <PermissionRow
            icon={MapPinIcon}
            label="Location"
            detail={locationDetail || "Required for verification and service availability."}
            status={location}
          />
          <PermissionRow
            icon={GlobeIcon}
            label="Network Speed"
            detail={networkDetail || "Checking your internet connection for a stable consultation experience."}
            status={network}
          />

          {/* Inline error block for denied permissions */}
          {hasDenied && (
            <div className="p-3 rounded-xl bg-[#fee2e2] border border-[#fca5a5] text-xs text-[#dc2626] space-y-1.5 leading-relaxed">
              {camera === STATUS.DENIED && (
                <p><span className="font-bold">Camera — </span>{permissionErrMsg(cameraError)}</p>
              )}
              {mic === STATUS.DENIED && (
                <p><span className="font-bold">Microphone — </span>{permissionErrMsg(micError)}</p>
              )}
              {location === STATUS.DENIED && (
                <p><span className="font-bold">Location — </span>{permissionErrMsg(locationError, true)}</p>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[rgba(0,0,0,0.05)]" />

        {/* Footer */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            {/* Retry link shown only when something is denied */}
            {hasDenied ? (
              <button
                onClick={runChecks}
                className="text-sm font-medium text-orange-450 hover:underline transition-colors"
              >
                ↺ Retry
              </button>
            ) : (
              <span />
            )}

            <button
              disabled={!criticalDone}
              onClick={onDone}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-white transition-colors ${
                criticalDone
                  ? "bg-orange-450 hover:bg-orange-500 active:scale-95"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {criticalDone
                ? "Continue to Call"
                : camera === STATUS.CHECKING || mic === STATUS.CHECKING || location === STATUS.CHECKING
                ? "Checking…"
                : "Allow permissions to continue"}
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
