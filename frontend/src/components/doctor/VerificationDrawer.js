import React, { useState } from "react";
import { XMarkIcon, ExclamationCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

/* ───────────────────────── Shared primitives ───────────────────────── */

function DrawerShell({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="flex flex-col h-full w-full md:w-[400px] bg-[#101113] border-l border-[rgba(255,255,255,0.05)]">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-[rgba(255,255,255,0.03)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
          {onClose && (
            <button onClick={onClose} className="shrink-0 text-[#919093] hover:text-white transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        {subtitle && <p className="text-[#919093] text-xs mt-1 leading-relaxed pr-6">{subtitle}</p>}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>

      {/* Sticky footer — full-width button on mobile (Figma), right-aligned on desktop */}
      {footer && <div className="shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.03)] flex items-center gap-3 [&>button]:w-full [&>button]:md:w-auto">{footer}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-[12px] border border-[rgba(255,255,255,0.05)] overflow-hidden">
      {title && <p className="px-4 pt-3.5 pb-2 text-white text-sm font-semibold">{title}</p>}
      <div className="px-4 pb-3.5">{children}</div>
    </div>
  );
}

function GreenBadge({ children }) {
  return (
    <span className="px-[6px] py-[2px] rounded-[12px] text-xs font-normal text-[#bbf7d0] bg-[rgba(22,101,52,0.1)] border border-[rgba(22,101,52,0.5)]">
      {children}
    </span>
  );
}

function MetricRow({ label, value, badge }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2 border-b border-[#303033] last:border-0">
      <span className="text-[#919093] text-sm shrink-0">{label}</span>
      {badge ? <GreenBadge>{value}</GreenBadge>
        : <span className="text-white text-sm text-right break-words min-w-0 max-w-[60%]">{value}</span>}
    </div>
  );
}

// One row per device kind, showing only the device the patient is using.
// Label on top, full device name below (wraps — never truncated).
function ActiveDeviceRow({ label, value, off }) {
  return (
    <div className="py-2.5 border-b border-[#303033] last:border-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[#919093] text-xs">{label}</span>
        {value && <GreenBadge>Active</GreenBadge>}
      </div>
      {value ? (
        <p className="text-white text-sm leading-5 break-words">{value}</p>
      ) : (
        <p className="text-[#77777a] text-sm italic">{off || "Not detected"}</p>
      )}
    </div>
  );
}

/* ───────────────────────── Connection Details ───────────────────────── */

export function ConnectionDetailsPanel({ onClose, deviceInfo, geoData, geoFailed, onRequestLocation, hideCameras = false }) {
  const [requesting, setRequesting] = useState(false);

  // Only the devices in use. activeCamera / activeMic come from the tracks the
  // patient is publishing, so null there means that device is turned off.
  // Older payloads without them fall back to the selected labels.
  const hasActive = deviceInfo && "activeMic" in deviceInfo;
  const camera = hasActive ? deviceInfo.activeCamera : deviceInfo?.selectedCameraLabel;
  const mic = hasActive ? deviceInfo.activeMic : deviceInfo?.selectedMicLabel;
  const output = deviceInfo?.activeOutput || null;
  const region = [geoData?.city || deviceInfo?.city, geoData?.region || deviceInfo?.region, geoData?.country || deviceInfo?.country]
    .filter(Boolean)
    .join(", ");

  async function handleRequestLocation() {
    setRequesting(true);
    try {
      await onRequestLocation?.();
    } finally {
      setRequesting(false);
    }
  }

  return (
    <DrawerShell
      title="Connection Details"
      subtitle="Review device, network, location, and connected hardware information for this participant."
      onClose={onClose}
    >
      <Card title="Active Devices">
        {!hideCameras && <ActiveDeviceRow label="Camera" value={camera} off={hasActive ? "Camera off" : undefined} />}
        <ActiveDeviceRow label="Microphone" value={mic} off={hasActive ? "Mic off" : undefined} />
        <ActiveDeviceRow label="Speaker" value={output} off="System default" />
      </Card>

      <Card title="Location">
        {geoData?.latitude != null ? (
          <div className="space-y-0">
            <MetricRow label="Latitude" value={geoData.latitude.toFixed(6)} />
            <MetricRow label="Longitude" value={geoData.longitude.toFixed(6)} />
            {region && <MetricRow label="Region" value={region} />}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Notification card — red bg when failed, neutral when pending */}
            <div className={`flex gap-2 items-start pl-3 pr-2 py-2 rounded-lg border border-[rgba(255,255,255,0.05)] ${
              geoFailed ? "bg-[rgba(153,27,27,0.1)]" : "bg-[rgba(255,255,255,0.02)]"
            }`}>
              <div className="flex items-center py-0.5 shrink-0">
                {geoFailed
                  ? <ExclamationCircleIcon className="w-4 h-4 text-white" />
                  : <InformationCircleIcon className="w-4 h-4 text-white" />
                }
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-medium text-white leading-5">
                  {geoFailed ? "Failed to Retrieve Location" : "Location Access Required"}
                </p>
                <p className="text-xs text-[#c7c6c9] leading-4">
                  {geoFailed
                    ? "Please ensure location access is enabled on your device to continue with the Application verification process."
                    : "To continue with your Application verification, please allow location access on your device."
                  }
                </p>
              </div>
            </div>

            {/* Request button */}
            <button
              onClick={handleRequestLocation}
              disabled={requesting}
              className="w-full flex items-center justify-center px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] text-sm font-medium text-white hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-50 transition-colors"
            >
              {requesting ? "Requesting…" : "Request Location Access"}
            </button>
          </div>
        )}
      </Card>
    </DrawerShell>
  );
}
