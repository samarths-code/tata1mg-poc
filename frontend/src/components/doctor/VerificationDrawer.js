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
          <button onClick={onClose} className="shrink-0 text-[#919093] hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
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

function RedBadge({ children }) {
  return (
    <span className="px-[6px] py-[2px] rounded-[12px] text-xs font-normal text-[#fecaca] bg-[rgba(153,27,27,0.1)] border border-[rgba(153,27,27,0.5)]">
      {children}
    </span>
  );
}

function MetricRow({ label, value, badge, error }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2 border-b border-[#303033] last:border-0">
      <span className="text-[#919093] text-sm shrink-0">{label}</span>
      {badge ? <GreenBadge>{value}</GreenBadge>
        : error ? <RedBadge>{value}</RedBadge>
        : <span className="text-white text-sm text-right break-words min-w-0 max-w-[60%]">{value}</span>}
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

export function ConnectionDetailsPanel({ onClose, deviceInfo, geoData, geoFailed, onRequestLocation, onNextStep }) {
  const [requesting, setRequesting] = useState(false);

  const cameras = deviceInfo?.cameras || [];
  const mics = deviceInfo?.microphones || [];
  const outputs = deviceInfo?.audioOutputs || [];
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
      footer={
        onNextStep && (
          <button
            onClick={onNextStep}
            className="ml-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#ff6f61] hover:bg-[#e85e51] transition-colors"
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
            {region && <MetricRow label="Region" value={"NEW DELHI, DELHI CAPITAL TERRITORY, INDIA"} />}
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
                    ? "Please ensure location access is enabled on your device to continue with the consultation verification process."
                    : "To continue with your consultation verification, please allow location access on your device."
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

/* ───────────────────────── Hoverable photo with Retake/Crop actions ──────── */

function HoverableImage({ src, alt, className, onRetake, onCrop, isCompleted = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-[#303033] ${isCompleted ? "" : "cursor-pointer"} ${className}`}
      onMouseEnter={() => !isCompleted && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={src} alt={alt} className="w-full object-cover" />
      {/* Retake/Crop actions hidden when step is already approved */}
      {hovered && !isCompleted && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-2">
          <button
            onClick={onRetake}
            className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] px-2 py-1 rounded-[6px] text-xs font-medium text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
          >
            Retake
          </button>
          <button
            onClick={onCrop}
            className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] px-2 py-1 rounded-[6px] text-xs font-medium text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
          >
            Crop
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Identity Verification ───────────────────────── */

export function IdentityVerificationPanel({
  onClose, frontImage, backImage, ocrResult, captureDevice, verifiedAt,
  onRetake, onApprove, onCropFront, onCropBack, isCompleted = false,
}) {
  const ocrOk = ocrResult && !ocrResult.error && !ocrResult.loading;
  const f = ocrResult?.fields || {};

  // Confidence: VideoSDK may return 0–1 or 0–100; normalise to percent
  const rawConf = f.confidence ?? f.accuracy ?? f.score ?? f.confidenceScore;
  const confPct = rawConf != null ? Math.round(rawConf <= 1 ? rawConf * 100 : rawConf) : null;

  // Extracted personal fields — show whichever the API returned
  const extracted = [
    { label: "Name",          value: f.name },
    { label: "Date of Birth", value: f.dob || f.dateOfBirth || f.date_of_birth },
    { label: "Gender",        value: f.gender },
    { label: "ID Number",     value: f.idNumber || f.uid || f.aadhaarNumber },
    { label: "Address",       value: f.address },
  ].filter((row) => row.value);

  return (
    <DrawerShell
      title="Identity Verification"
      subtitle="Review and verify the captured patient document before proceeding with the consultation."
      onClose={onClose}
      footer={
        !isCompleted && (
          <>
            <button
              onClick={onRetake}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#303033] hover:bg-[#3a3a3d] transition-colors"
            >
              Retake Document
            </button>
            <button
              onClick={onApprove}
              disabled={ocrResult?.loading}
              className="ml-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#ff6f61] hover:bg-[#e85e51] disabled:opacity-40 transition-colors"
            >
              Approve Document
            </button>
          </>
        )
      }
    >
      <Card title="Verification Summary">
        <div className="space-y-2">
          {frontImage && (
            <HoverableImage
              src={frontImage} alt="Document front" className="max-h-32"
              onRetake={onRetake}
              onCrop={() => onCropFront?.(frontImage)}
              isCompleted={isCompleted}
            />
          )}
          {backImage && (
            <HoverableImage
              src={backImage} alt="Document back" className="max-h-32"
              onRetake={onRetake}
              onCrop={() => onCropBack?.(backImage)}
              isCompleted={isCompleted}
            />
          )}
          {!frontImage && !backImage && <p className="text-[#77777a] text-xs italic">No document captured yet</p>}
        </div>
        <div className="mt-3">
          <MetricRow
            label="OCR Detection"
            value={
              ocrResult?.loading ? "Running…"
              : ocrOk ? "Successful"
              : ocrResult?.error ? (ocrResult.message || "Failed")
              : "—"
            }
            badge={ocrOk}
            error={!ocrOk && !ocrResult?.loading && !!ocrResult?.error}
          />
          {confPct != null && (
            <MetricRow label="Confidence" value={`${confPct}%`} badge={ocrOk} />
          )}
          <MetricRow label="Document Type" value={f.idType || "Aadhaar Card"} />
          <MetricRow label="Verification Time" value={verifiedAt || "—"} />
        </div>
      </Card>

      {ocrOk && extracted.length > 0 && (
        <Card title="Extracted Information">
          {extracted.map(({ label, value }) => (
            <MetricRow key={label} label={label} value={String(value)} />
          ))}
        </Card>
      )}

      <Card title="Capture Details">
        <MetricRow label="Capture Device" value={captureDevice || "—"} />
      </Card>
    </DrawerShell>
  );
}

/* ───────────────────────── Face Verification ───────────────────────── */

export function FaceVerificationPanel({
  onClose, photo, faceMatchResult, spoofResult, captureDevice, verifiedAt,
  patientName, consultationId, onRetake, onApprove, onCropPhoto, isCompleted = false,
}) {
  const matched = faceMatchResult && !faceMatchResult.loading && !faceMatchResult.error &&
    (faceMatchResult.matched ?? faceMatchResult.match);
  const live = spoofResult && !spoofResult.loading && !spoofResult.error && spoofResult.isReal;

  // Face match score: 0–1 → percent
  const rawScore = faceMatchResult?.score ?? faceMatchResult?.similarity ?? faceMatchResult?.confidence;
  const matchPct = rawScore != null ? Math.round(rawScore <= 1 ? rawScore * 100 : rawScore) : null;

  // Liveness confidence: 0–1 or 0–100 → percent
  const rawLiveness = spoofResult?.confidence ?? spoofResult?.accuracy;
  const livenessPct = rawLiveness != null ? Math.round(rawLiveness <= 1 ? rawLiveness * 100 : rawLiveness) : null;

  const faceMatchLoading = faceMatchResult?.loading;
  const spoofLoading = spoofResult?.loading;

  return (
    <DrawerShell
      title="Face Verification"
      subtitle="Review and verify the captured patient photo before starting the consultation."
      onClose={onClose}
      footer={
        !isCompleted && (
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
              className="ml-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#ff6f61] hover:bg-[#e85e51] disabled:opacity-40 transition-colors"
            >
              Approve Photo
            </button>
          </>
        )
      }
    >
      <Card title="Verification Summary">
        {photo ? (
          <HoverableImage
            src={photo} alt="Captured" className="max-h-40"
            onRetake={onRetake}
            onCrop={() => onCropPhoto?.(photo)}
            isCompleted={isCompleted}
          />
        ) : (
          <p className="text-[#77777a] text-xs italic">No photo captured yet</p>
        )}
        <div className="mt-3">
          <MetricRow
            label="Face Match Score"
            value={
              faceMatchLoading ? "Checking…"
              : matched && matchPct != null ? `${matchPct}% Match`
              : matched ? "Matched"
              : "—"
            }
            badge={matched}
          />
          <MetricRow
            label="Liveness Check"
            value={
              spoofLoading ? "Checking…"
              : live && livenessPct != null ? `Passed · ${livenessPct}% confidence`
              : live ? "Passed"
              : spoofResult && !spoofLoading ? "Failed"
              : "—"
            }
            badge={live}
          />
          <MetricRow label="Verification Time" value={verifiedAt || "—"} />
        </div>
      </Card>

      <Card title="Capture Details">
        <MetricRow label="Capture Device" value={captureDevice || "—"} />
      </Card>

      <Card title="Patient Information">
        <MetricRow label="Patient Name" value={patientName || "—"} />
        <MetricRow label="Consultation ID" value={consultationId || "—"} />
      </Card>
    </DrawerShell>
  );
}
