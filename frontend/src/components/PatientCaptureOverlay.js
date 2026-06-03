import React from "react";

/**
 * Guided capture overlay shown on the PATIENT's screen while the doctor
 * captures their document / photo (Figma screens 26/27/66/67).
 *
 * Purely a guide — green dashed frame + instruction, no controls.
 *   - 'document' → frame is landscape, instruction above
 *   - 'face'     → frame is portrait, instruction below
 */
export default function PatientCaptureOverlay({ variant = "document" }) {
  const isFace = variant === "face";
  const heading = isFace
    ? "Please position yourself clearly in front of the camera."
    : "Hold the document steady inside the frame";

  const frameStyle = isFace
    ? { width: "min(72vw, 320px)", aspectRatio: "3 / 4" }
    : { width: "min(90vw, 480px)", aspectRatio: "16 / 10" };

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/30" />

      {!isFace && (
        <p className="relative text-white text-lg font-medium mb-4 text-center px-6 drop-shadow-lg">
          {heading}
        </p>
      )}

      <div
        className="relative rounded-2xl"
        style={{ ...frameStyle, border: "3px dashed #86efac" }}
      />

      {isFace && (
        <p className="relative text-white text-lg font-medium mt-4 text-center px-6 drop-shadow-lg">
          {heading}
        </p>
      )}
    </div>
  );
}
