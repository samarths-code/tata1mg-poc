import React, { useState, useEffect } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import { participantModes } from "../../utils/common";

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STEP_LABELS = {
  1: "Step 1: Connection Verification",
  2: "Step 2: Identity Verification",
  3: "Step 3: Face Verification",
};

export function TopBar({ bottomBarHeight, caseId, meetingTitle }) {
  const { participantMode } = useMeetingAppContext();
  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  const [time, setTime] = useState(getCurrentTime());
  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 30000);
    return () => clearInterval(id);
  }, []);

  // Mirror the doctor's verification progress, broadcast over pubsub.
  const [verif, setVerif] = useState({ step: 1, completed: [] });
  usePubSub("VERIFICATION_STEP", {
    onMessageReceived: ({ payload }) => { if (payload) setVerif(payload); },
    onOldMessagesReceived: (messages) => {
      const last = messages[messages.length - 1];
      if (last?.payload) setVerif(last.payload);
    },
  });

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

      {/* Right: step pills (patient mirrors doctor) or case badge (doctor) */}
      <div className="flex items-center gap-2 shrink-0">
        {isDoctor ? (
          caseId && (
            <span className="font-mono text-xs font-semibold bg-[rgba(255,255,255,0.08)] text-white px-3 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] truncate max-w-[140px]">
              {caseId}
            </span>
          )
        ) : (
          // Customer sees only the doctor's currently-active step.
          STEP_LABELS[verif.step] && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white whitespace-nowrap border bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.25)]">
              {verif.completed?.includes(verif.step) && (
                <CheckCircleIcon className="w-4 h-4 text-[#86efac] shrink-0" />
              )}
              {STEP_LABELS[verif.step]}
            </div>
          )
        )}
      </div>
    </div>
  );
}
