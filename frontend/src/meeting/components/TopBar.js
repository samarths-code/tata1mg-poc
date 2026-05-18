import React from "react";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import { participantModes } from "../../utils/common";
import Tata1mgLogo from "../../components/Tata1mgLogo";

export function TopBar({ bottomBarHeight, caseId }) {
  const { participantMode } = useMeetingAppContext();
  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  return (
    <div
      style={{ height: bottomBarHeight }}
      className="flex px-3 sm:px-5 bg-gray-750 items-center justify-between border-b border-gray-600 shrink-0 gap-2"
    >
      <Tata1mgLogo size={28} />

      {isDoctor && caseId && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden sm:block text-gray-900 text-xs">Case ID</span>
          <span className="font-mono text-xs font-semibold bg-gray-700 text-white px-2 sm:px-3 py-1 rounded-lg max-w-[100px] sm:max-w-none truncate">
            {caseId}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-250 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-150" />
        </span>
        <span
          className={`text-xs px-2 sm:px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
            isDoctor ? "bg-orange-450 text-white" : "bg-green-350 text-green-550"
          }`}
        >
          {isDoctor ? "Doctor" : "Customer"}
        </span>
      </div>
    </div>
  );
}
