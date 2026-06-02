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

  const frameColor = ready ? "#86efac" : "#fca5a5"; // green-300 / red-300

  // Width-based sizing for a large, prominent frame; maxHeight keeps it clear of
  // the absolutely-anchored controls so it can't overlap or clip them.
  const frameStyle = isFace
    ? { width: "min(42%, 480px)", aspectRatio: "3 / 3.7", maxHeight: "66%", maxWidth: "82%" }
    : { width: "min(66%, 820px)", aspectRatio: "16 / 10", maxHeight: "60%", maxWidth: "90%" };

  return (
    <div className="absolute inset-0 z-10">
      {/* Dim the video slightly to emphasise the frame */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Centered frame + instruction — reserves bottom space for the controls */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-28 pointer-events-none">
        {!isFace && (
          <p className="text-white text-lg font-medium mb-4 text-center drop-shadow-lg">{heading}</p>
        )}

        <div className="rounded-2xl" style={{ ...frameStyle, border: `3px dashed ${frameColor}` }} />

        {isFace && (
          <p className="text-white text-lg font-medium mt-4 text-center drop-shadow-lg">{heading}</p>
        )}
      </div>

      {/* Control row — anchored to the bottom so it's never clipped */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-auto">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#303033] hover:bg-[#3a3a3d] transition-colors"
        >
          Cancel
        </button>

        <button
          onClick={onCapture}
          disabled={!ready || capturing}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
            ready && !capturing
              ? "bg-orange-450 hover:bg-orange-500"
              : "bg-orange-450/40 cursor-not-allowed"
          }`}
        >
          <CameraIcon className="w-4 h-4" />
          {capturing ? "Capturing…" : captureLabel}
        </button>

        {cameras.length > 0 && (
          <div className="relative">
            <select
              value={selectedCameraId || ""}
              onChange={(e) => onSelectCamera?.(e.target.value)}
              className="appearance-none px-4 py-2.5 pr-9 rounded-lg text-sm font-medium text-white bg-[#303033] border border-[#404043] focus:outline-none cursor-pointer max-w-[200px] truncate"
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
