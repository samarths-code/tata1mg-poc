import React, { useState, useEffect } from "react";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import { participantModes } from "../../utils/common";
import useIsRecording from "../../hooks/useIsRecording";
import useIsMobile from "../../hooks/useIsMobile";

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TopBar({ bottomBarHeight, caseId, meetingTitle, onToggleParticipantPanel }) {
  const { participantMode } = useMeetingAppContext();
  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;
  const isRecording = useIsRecording();
  const isMobile = useIsMobile();

  const [time, setTime] = useState(getCurrentTime());
  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 30000);
    return () => clearInterval(id);
  }, []);

  const title = meetingTitle || (caseId ? `Case: ${caseId}` : "");

  return (
    <div
      className="flex items-center justify-between px-5 shrink-0 z-10"
      style={{ height: bottomBarHeight }}
    >
      {/* Left: time · title · REC badge */}
      <div className="flex items-center gap-2 text-white min-w-0">
        <span className="text-base font-medium whitespace-nowrap" style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}>
          {time}
        </span>
        {title && (
          <>
            <div className="h-5 w-px bg-white/30 shrink-0" />
            <span className="text-base overflow-hidden text-ellipsis max-w-xs" style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}>
              {title}
            </span>
          </>
        )}
        {isRecording && (
          <span className="flex items-center gap-1 px-[6px] py-[2px] rounded-[12px] shrink-0 bg-[rgba(153,27,27,0.1)] border border-[rgba(153,27,27,0.5)]">
            <span className="w-2 h-2 rounded-full bg-[#fca5a5] animate-pulse shrink-0" />
            <span className="text-[#fecaca] text-xs font-normal leading-4">REC</span>
          </span>
        )}
      </div>

      {/* Right — Participant Details hidden on mobile (panel opens full-screen from elsewhere) */}
      <div className="flex items-center gap-2 shrink-0">
        {isDoctor ? (
          caseId && (
            <span className="font-mono text-xs font-semibold bg-[rgba(255,255,255,0.08)] text-white px-3 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] truncate max-w-[140px]">
              {caseId}
            </span>
          )
        ) : (
          !isMobile && (
            <button
              onClick={onToggleParticipantPanel}
              className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            >
              Participant Details
            </button>
          )
        )}
      </div>
    </div>
  );
}
