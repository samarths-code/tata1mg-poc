import React from "react";

/**
 * Centered status overlay shown over the main video during transient call
 * states (Figma 35/36/37/38/39/40/65). The video stays visible but dimmed;
 * the PiP and control bar remain interactive underneath.
 */
export default function ConnectionStatusOverlay({ message }) {
  if (!message) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/45" />
      <p className="relative text-white text-[28px] font-medium drop-shadow-lg select-none">
        {message}
      </p>
    </div>
  );
}
