import React from "react";
import { CameraIcon } from "@heroicons/react/24/solid";

/**
 * On-video capture overlay matching the Figma capture screens (7/8/9/11/13/14/51-57).
 *
 *  - A dashed frame centered over the participant video: RED when not ready,
 *    GREEN when aligned/ready to capture.
 *  - Instruction text: ABOVE the frame for documents, BELOW for the face/photo.
 *  - A control row anchored to the BOTTOM: Cancel · Capture <label> · camera dropdown.
 *
 * The frame is sized by height (with a max) and the controls are absolutely
 * anchored, so neither can be clipped by the video container's overflow — the
 * controls stay visible whether or not the verification drawer is open.
 */
export default function CaptureOverlay({
  variant = "document-front", // 'document-front' | 'document-back' | 'face'
  ready = false,              // green (ready) vs red (not aligned)
  capturing = false,
  onCancel,
  onCapture,
  cameras = [],
  selectedCameraId,
  onSelectCamera,
}) {
  const isFace = variant === "face";

  const heading = {
    "document-front": "Capture the Front Side of The Document",
    "document-back": "Capture the Back Side of The Document",
    face: "Please position yourself clearly in front of the camera.",
  }[variant];

  const captureLabel = {
    "document-front": "Capture Front Side",
    "document-back": "Capture Back Side",
    face: "Capture Photo",
  }[variant];

  // Figma: red (#dc2626) when not aligned, green (#4bd559) when ready
  const frameColor = ready ? "#4bd559" : "#dc2626";

  // Frame is sized for a portrait mobile video stream (9:16 from the patient's phone).
  // Face: portrait 3:4 to match a mobile selfie crop zone.
  // Document: landscape 16:10 (Aadhaar card ratio) constrained in height so it fits
  // within the portrait video without overflowing the control row below.
  const frameStyle = isFace
    ? { height: "min(62%, 520px)", aspectRatio: "3 / 4", maxWidth: "55%" }
    : { width: "min(72%, 560px)", aspectRatio: "16 / 10", maxHeight: "42%", maxWidth: "88%" };

  return (
    <div className="absolute inset-0 z-10">
      {/* Dim the video slightly to emphasise the frame */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Centered frame + instruction — reserves bottom space for the controls */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-28 pointer-events-none">
        {!isFace && (
          <p className="text-white text-lg font-medium mb-4 text-center drop-shadow-lg">{heading}</p>
        )}

        <div
          style={{
            ...frameStyle,
            border: `3px dashed ${frameColor}`,
            borderRadius: isFace ? "24px" : "12px",
          }}
        />

        {isFace && (
          <p className="text-white text-lg font-medium mt-4 text-center drop-shadow-lg">{heading}</p>
        )}
      </div>

      {/* Control row — Figma: Cancel + Capture on row 1, camera picker on row 2 */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-full px-4 flex flex-col items-center gap-2 pointer-events-auto">
        {/* Row 1: Cancel + Capture */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.2)] transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={onCapture}
            disabled={!ready || capturing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
              ready && !capturing
                ? "bg-[#ff6f61] hover:bg-[#e85e51]"
                : "bg-[#ff6f61]/50 cursor-not-allowed"
            }`}
          >
            <CameraIcon className="w-4 h-4" />
            {capturing ? "Capturing…" : captureLabel}
          </button>
        </div>

        {/* Row 2: Camera selector (full-width) */}
        {cameras.length > 0 && (
          <div className="relative w-[178px]">
            <select
              value={selectedCameraId || ""}
              onChange={(e) => onSelectCamera?.(e.target.value)}
              className="appearance-none w-full px-4 py-2.5 pr-9 rounded-lg text-sm font-medium text-white bg-[rgba(255,255,255,0.15)] border border-[rgba(0,0,0,0.05)] focus:outline-none cursor-pointer truncate"
            >
              {cameras.map((cam, i) => (
                <option key={cam.deviceId || i} value={cam.deviceId}>
                  {cam.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none"
              viewBox="0 0 20 20" fill="currentColor"
            >
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
