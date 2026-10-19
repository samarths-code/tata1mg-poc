import React, { useState, useEffect } from "react";
import useIsRecording from "../../hooks/useIsRecording";
import useIsMobile from "../../hooks/useIsMobile";

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Shared REC badge — same style used by both doctor and patient headers
export function RecBadge() {
  return (
    <span className="flex items-center gap-1 px-[6px] py-[2px] rounded-[12px] shrink-0 bg-[rgba(153,27,27,0.1)] border border-[rgba(153,27,27,0.5)]">
      <span className="w-2 h-2 rounded-full bg-[#fca5a5] animate-pulse shrink-0" />
      <span className="text-[#fecaca] text-[10px] font-normal leading-4">REC</span>
    </span>
  );
}

export default function DoctorTopBar({ meetingTitle, caseId }) {
  // All hooks must be called unconditionally — before any early return
  const isMobile = useIsMobile();
  const [time, setTime] = useState(getCurrentTime());
  const isRecording = useIsRecording();
  const title = meetingTitle || (caseId ? `Case: ${caseId}` : "VKYC Application");

  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 30000);
    return () => clearInterval(id);
  }, []);

  // Mobile: same simple header as patient — title + REC badge only
  if (isMobile) {
    return (
      <div className="flex items-start justify-between px-4 pt-[59px] shrink-0">
        <p className="flex-1 text-white text-sm font-medium leading-5 pr-2 line-clamp-2">{title}</p>
        {isRecording && <RecBadge />}
      </div>
    );
  }

  // Desktop: time + title + REC
  return (
    <div className="flex items-center justify-between px-5 shrink-0 z-20 h-14">
      <div className="flex items-center gap-2 text-white min-w-0">
        <span className="text-base font-medium whitespace-nowrap">{time}</span>
        <div className="h-5 w-px bg-white/30 shrink-0" />
        <span className="text-base whitespace-nowrap overflow-hidden text-ellipsis">{title}</span>
        {isRecording && <RecBadge />}
      </div>
    </div>
  );
}
