import { useEffect, useState } from "react";
import { getNetworkStats } from "@videosdk.live/react-sdk";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

const STATUS = { IDLE: "idle", CHECKING: "checking", GRANTED: "granted", DENIED: "denied" };

function StatusDot({ status }) {
  if (status === STATUS.CHECKING) {
    return (
      <span className="w-6 h-6 flex items-center justify-center shrink-0">
        <span className="w-5 h-5 rounded-full border-[3px] border-orange-450 border-t-transparent animate-spin block" />
      </span>
    );
  }
  if (status === STATUS.GRANTED) {
    return (
      <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === STATUS.DENIED) {
    return (
      <span className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return <span className="w-6 h-6 rounded-full border-2 border-gray-200 shrink-0" />;
}

function PermissionRow({ emoji, label, detail, status, critical }) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
        status === STATUS.GRANTED
          ? "bg-green-50 border-green-200"
          : status === STATUS.DENIED
          ? "bg-red-50 border-red-200"
          : status === STATUS.CHECKING
          ? "bg-orange-50 border-orange-200"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-colors duration-300 ${
          status === STATUS.GRANTED
            ? "bg-green-100"
            : status === STATUS.DENIED
            ? "bg-red-100"
            : status === STATUS.CHECKING
            ? "bg-orange-100"
            : "bg-white"
        }`}
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          {critical && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-450 bg-orange-450/10 px-1.5 py-0.5 rounded-md">
              Required
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{detail}</p>
      </div>
      <StatusDot status={status} />
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
  const [location, setLocation] = useState(STATUS.IDLE);
  const [network,  setNetwork]  = useState(STATUS.IDLE);
  const [networkDetail,  setNetworkDetail]  = useState(null);
  const [locationDetail, setLocationDetail] = useState(null);
  const [cameraError,   setCameraError]   = useState(null);
  const [micError,      setMicError]      = useState(null);
  const [locationError, setLocationError] = useState(null);

  // Hard block — camera, mic AND location must all be granted before proceeding
  const criticalDone =
    camera   === STATUS.GRANTED &&
    mic      === STATUS.GRANTED &&
    location === STATUS.GRANTED;

  const totalDone = [camera, mic, location, network].filter(
    (s) => s === STATUS.GRANTED || s === STATUS.DENIED
  ).length;
  const progress = Math.round((totalDone / 4) * 100);

  useEffect(() => {
    runChecks();
  }, []);

  async function runChecks() {
    // Some USB audio/video devices hang getUserMedia indefinitely — cap at 10s
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
    } catch (err) {
      setMic(STATUS.DENIED);
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
      // GeolocationPositionError codes: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/80 backdrop-blur-sm p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Gradient header */}
        <div className="bg-gradient-to-br from-orange-450 to-orange-500 px-7 pt-7 pb-6">
          <div className="flex items-center gap-3 mb-5">
            <img
              src="https://play-lh.googleusercontent.com/yjbAu08_Ahes38IEMV8slP91zgjh2mdh5xpZefvcbYuZxR8O7FZFderRn2Ivaz0uR2Lw"
              alt="Tata 1mg"
              className="w-10 h-10 rounded-xl object-contain bg-white/20"
            />
            <div className="leading-none">
              <p className="text-white font-bold text-sm">Tata 1mg</p>
              <p className="text-white/70 text-xs mt-0.5">Video MER</p>
            </div>
          </div>
          <h2 className="text-white text-2xl font-bold tracking-tight">Before we begin</h2>
          <p className="text-white/75 text-sm mt-1.5">
            Allow these permissions to join your consultation
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-orange-100">
          <div
            className="h-1.5 bg-orange-450 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Permission list */}
        <div className="px-6 pt-5 pb-4 space-y-3">
          <PermissionRow
            emoji="📹"
            label="Camera"
            detail="For video consultation"
            status={camera}
            critical
          />
          <PermissionRow
            emoji="🎙️"
            label="Microphone"
            detail="For voice communication"
            status={mic}
            critical
          />
          <PermissionRow
            emoji="📍"
            label="Location"
            detail={locationDetail || "Required for MER report"}
            status={location}
            critical
          />
          <PermissionRow
            emoji="🌐"
            label="Network Speed"
            detail={networkDetail || "Checking your connection…"}
            status={network}
          />
        </div>

        {/* Continue button */}
        <div className="px-6 pb-8 pt-1">
          {(camera === STATUS.DENIED || mic === STATUS.DENIED || location === STATUS.DENIED) && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1.5 leading-relaxed">
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
          <button
            disabled={!criticalDone}
            onClick={onDone}
            className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
              criticalDone
                ? "bg-orange-450 hover:bg-orange-500 text-white shadow-lg shadow-orange-450/25 active:scale-95"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {criticalDone ? (
              <>
                Continue to call
                <ArrowRightIcon className="w-4 h-4" />
              </>
            ) : camera === STATUS.CHECKING || mic === STATUS.CHECKING || location === STATUS.CHECKING ? (
              "Checking permissions…"
            ) : (
              "Allow camera, mic & location to continue"
            )}
          </button>
          {(camera === STATUS.DENIED || mic === STATUS.DENIED || location === STATUS.DENIED) && (
            <button
              onClick={runChecks}
              className="mt-2 w-full py-3 rounded-2xl text-sm font-semibold text-orange-450 border border-orange-450/40 hover:bg-orange-450/5 active:scale-95 transition-all"
            >
              ↺ Retry permission check
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
