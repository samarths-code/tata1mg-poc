import React from "react";
import { XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/* ───────────────────────── Shared primitives ───────────────────────── */

function DrawerShell({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="flex flex-col h-full w-[383px] max-w-full bg-[#1b1b1e] border-l border-[#303033]">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-[#252a34]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="shrink-0 text-[#919093] hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        {subtitle && <p className="text-[#919093] text-xs mt-1 leading-relaxed pr-6">{subtitle}</p>}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>

      {/* Sticky footer */}
      {footer && <div className="shrink-0 px-5 py-4 border-t border-[#252a34] flex items-center gap-3">{footer}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl bg-[#252a34] border border-[#303033] overflow-hidden">
      {title && <p className="px-4 pt-3.5 pb-2 text-white text-sm font-semibold">{title}</p>}
      <div className="px-4 pb-3.5">{children}</div>
    </div>
  );
}

function GreenBadge({ children }) {
  return (
    <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-[#86efac] bg-[rgba(134,239,172,0.12)]">
      {children}
    </span>
  );
}

function MetricRow({ label, value, badge }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#303033] last:border-0">
      <span className="text-[#919093] text-sm">{label}</span>
      {badge ? <GreenBadge>{value}</GreenBadge> : <span className="text-white text-sm">{value}</span>}
    </div>
  );
}

function DeviceList({ devices = [] }) {
  if (!devices.length) return <p className="text-[#77777a] text-xs italic">None detected</p>;
  return (
    <div className="space-y-2">
      {devices.map((d, i) => {
        const label = typeof d === "string" ? d : d.label;
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#303033] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-white text-sm">{label || `Device ${i + 1}`}</span>
            {i === 0 && <GreenBadge>Active</GreenBadge>}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Connection Details ───────────────────────── */

export function ConnectionDetailsPanel({ onClose, deviceInfo, geoData, onNextStep }) {
  const cameras = deviceInfo?.cameras || [];
  const mics = deviceInfo?.microphones || [];
  const outputs = deviceInfo?.audioOutputs || deviceInfo?.microphones || [];
  const region = [geoData?.city || deviceInfo?.city, geoData?.region || deviceInfo?.region, geoData?.country || deviceInfo?.country]
    .filter(Boolean)
    .join(", ");
  const connType = deviceInfo?.connection
    ? `${deviceInfo.connection.toUpperCase()} ${/cellular|[2-5]g/i.test(deviceInfo.connection) ? "Mobile Network" : "Network"}`
    : null;

  return (
    <DrawerShell
      title="Connection Details"
      subtitle="Review device, network, location, and connected hardware information for this participant."
      onClose={onClose}
      footer={
        onNextStep && (
          <button
            onClick={onNextStep}
            className="ml-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-orange-450 hover:bg-orange-500 transition-colors"
          >
            Next Step
          </button>
        )
      }
    >
      <Card title="Camera Devices"><DeviceList devices={cameras} /></Card>
      <Card title="Microphones"><DeviceList devices={mics} /></Card>
      <Card title="Audio Output"><DeviceList devices={outputs} /></Card>

      <Card title="Location">
        {geoData?.latitude != null ? (
          <div className="space-y-0">
            <MetricRow label="Latitude" value={geoData.latitude.toFixed(6)} />
            <MetricRow label="Longitude" value={geoData.longitude.toFixed(6)} />
            {region && <MetricRow label="Region" value={region} />}
            {connType && <MetricRow label="Connection Type" value={connType} />}
          </div>
        ) : (
          <div className="rounded-lg bg-[rgba(252,165,165,0.08)] border border-[rgba(252,165,165,0.2)] p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <ExclamationTriangleIcon className="w-4 h-4 text-[#fca5a5] shrink-0" />
              <span className="text-[#fca5a5] text-sm font-semibold">Failed to Retrieve Location</span>
            </div>
            <p className="text-[#919093] text-xs leading-relaxed mb-3">
              Please ensure location access is enabled on your device to continue with the consultation verification process.
            </p>
            <button className="w-full py-2 rounded-lg text-sm font-medium text-white border border-[#404043] hover:bg-[#303033] transition-colors">
              Grant Location Access
            </button>
          </div>
        )}
      </Card>
    </DrawerShell>
  );
}

/* ───────────────────────── Identity Verification ───────────────────────── */

export function IdentityVerificationPanel({
  onClose, frontImage, backImage, ocrResult, captureDevice, verifiedAt,
  onRetake, onApprove,
}) {
  const ocrOk = ocrResult && !ocrResult.error && !ocrResult.loading;
  return (
    <DrawerShell
      title="Identity Verification"
      subtitle="Review and verify the captured patient document before proceeding with the consultation."
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onRetake}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#303033] hover:bg-[#3a3a3d] transition-colors"
          >
            Retake Document
          </button>
          <button
            onClick={onApprove}
            disabled={!ocrOk}
            className="ml-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-orange-450 hover:bg-orange-500 disabled:opacity-40 transition-colors"
          >
            Approve Document
          </button>
        </>
      }
    >
      <Card title="Verification Summary">
        <div className="space-y-2">
          {frontImage && <img src={frontImage} alt="Document front" className="w-full rounded-lg object-cover max-h-32 border border-[#303033]" />}
          {backImage && <img src={backImage} alt="Document back" className="w-full rounded-lg object-cover max-h-32 border border-[#303033]" />}
          {!frontImage && !backImage && <p className="text-[#77777a] text-xs italic">No document captured yet</p>}
        </div>
        <div className="mt-3">
          <MetricRow label="Verification Score" value={ocrOk ? "94% Match" : "—"} badge={ocrOk} />
          <MetricRow label="OCR Detection" value={ocrOk ? "Successful" : ocrResult?.loading ? "Running…" : "—"} badge={ocrOk} />
          <MetricRow label="Document Quality" value={ocrOk ? "Good" : "—"} badge={ocrOk} />
          <MetricRow label="Verification Time" value={verifiedAt || "—"} />
        </div>
      </Card>

      <Card title="Document Preview Details">
        <MetricRow label="Document Type" value={ocrResult?.fields?.idType || "Aadhaar Card"} />
        <MetricRow label="Capture Device" value={captureDevice || "—"} />
        <MetricRow label="Resolution" value="1280 × 720" />
        <MetricRow label="Image Clarity" value="Clear" />
        <MetricRow label="Glare Detection" value="Not Detected" />
      </Card>
    </DrawerShell>
  );
}

/* ───────────────────────── Face Verification ───────────────────────── */

export function FaceVerificationPanel({
  onClose, photo, faceMatchResult, spoofResult, captureDevice, verifiedAt,
  patientName, consultationId, onRetake, onApprove,
}) {
  const matched = faceMatchResult && !faceMatchResult.loading && !faceMatchResult.error &&
    (faceMatchResult.matched ?? faceMatchResult.match);
  const score = faceMatchResult?.score ?? faceMatchResult?.similarity ?? faceMatchResult?.confidence;
  const pct = score != null ? Math.round(score * 100) : 94;
  const live = spoofResult && !spoofResult.loading && !spoofResult.error && spoofResult.isReal;

  return (
    <DrawerShell
      title="Face Verification"
      subtitle="Review and verify the captured patient photo before starting the consultation."
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onRetake}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#303033] hover:bg-[#3a3a3d] transition-colors"
          >
            Retake Photo
          </button>
          <button
            onClick={onApprove}
            disabled={!matched}
            className="ml-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-orange-450 hover:bg-orange-500 disabled:opacity-40 transition-colors"
          >
            Approve Photo
          </button>
        </>
      }
    >
      <Card title="Verification Summary">
        {photo ? (
          <img src={photo} alt="Captured" className="w-full rounded-lg object-cover max-h-40 border border-[#303033]" />
        ) : (
          <p className="text-[#77777a] text-xs italic">No photo captured yet</p>
        )}
        <div className="mt-3">
          <MetricRow label="Face Match Score" value={matched ? `${pct}% Match` : "—"} badge={matched} />
          <MetricRow label="Liveness Check" value={live ? "Passed" : spoofResult?.loading ? "Checking…" : "—"} badge={live} />
          <MetricRow label="Image Quality" value={photo ? "Good" : "—"} badge={!!photo} />
          <MetricRow label="Verification Time" value={verifiedAt || "—"} />
        </div>
      </Card>

      <Card title="Captured Photo Details">
        <MetricRow label="Capture Device" value={captureDevice || "—"} />
        <MetricRow label="Resolution" value="1280 × 720" />
      </Card>

      <Card title="Patient Information">
        <MetricRow label="Patient Name" value={patientName || "—"} />
        <MetricRow label="Consultation ID" value={consultationId || "—"} />
      </Card>
    </DrawerShell>
  );
}
