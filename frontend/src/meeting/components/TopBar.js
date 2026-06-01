import React, { useState, useEffect } from "react";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import { participantModes } from "../../utils/common";

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TopBar({ bottomBarHeight, caseId, meetingTitle, currentStep = 1 }) {
  const { participantMode } = useMeetingAppContext();
  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  const [time, setTime] = useState(getCurrentTime());
  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 30000);
    return () => clearInterval(id);
  }, []);

  const steps = [
    "Step 1: Identity Verification",
    "Step 2: Face Verification",
  ];

  return (
    <div
      className="flex items-center justify-between px-5 shrink-0 z-10"
      style={{ height: bottomBarHeight }}
    >
      {/* Left: time + meeting title */}
      <div className="flex items-center gap-2 text-white">
        <span
          className="text-base font-medium whitespace-nowrap"
          style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
        >
          {time}
        </span>
        {(meetingTitle || caseId) && (
          <>
            <div className="h-5 w-px bg-white/30 shrink-0" />
            <span
              className="text-base whitespace-nowrap overflow-hidden text-ellipsis max-w-xs"
              style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
            >
              {meetingTitle || (caseId ? `Case: ${caseId}` : "")}
            </span>
          </>
        )}
      </div>

      {/* Right: step pills (patient) or case badge (doctor) */}
      <div className="flex items-center gap-2 shrink-0">
        {isDoctor ? (
          caseId && (
            <span className="font-mono text-xs font-semibold bg-[rgba(255,255,255,0.08)] text-white px-3 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] truncate max-w-[140px]">
              {caseId}
            </span>
          )
        ) : (
          steps.map((step, i) => (
            <button
              key={i}
              className={`px-3 py-1.5 rounded text-sm font-medium text-white transition-opacity whitespace-nowrap ${
                i === currentStep - 1
                  ? "bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.2)]"
                  : "bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.02)] opacity-50"
              }`}
            >
              {step}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
