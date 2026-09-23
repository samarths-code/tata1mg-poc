import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useMeetingStore } from "../../store/meetingStore";

export function LeaveScreen({ participantName, onRejoin, asBackground = false }) {
  const isDoctor = useMeetingStore((s) => s.isDoctor);
  const displayName = participantName || (isDoctor ? "Doctor" : "Guest");

  // Rejoin the same session. Prefer an in-app callback (no page reload, so no
  // "Leave site?" prompt). Fall back to a full navigation with the preserved
  // params + rejoin=1 (used when the thank-you page was loaded/reloaded directly).
  const rejoinUrl = (() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("meetingId")) return null;
    params.set("rejoin", "1");
    return "/?" + params.toString();
  })();
  const canRejoin = !!(onRejoin || rejoinUrl);

  const handleRejoinClick = () => {
    if (onRejoin) { onRejoin(); return; }
    window.onbeforeunload = null; // avoid the browser "Leave site?" prompt on navigation
    window.location.href = rejoinUrl;
  };

  return (
    <div className={`fixed inset-0 ${asBackground ? "" : "z-50"} bg-white overflow-y-auto`}>

      {/* Centred content — stacks naturally so nothing clips on small screens */}
      <div className="min-h-full flex flex-col items-center justify-center gap-8 px-6 pt-[80px] pb-10">

        {/* Icon + title + subtitle + button */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-[#22c55e]" />
            <span className="text-[#5e5e61] text-sm font-medium">Application Completed</span>
          </div>

          <h1 className="text-black text-[24px] font-medium leading-[32px]">
            Thank You, {displayName}!
          </h1>

          <p className="text-[#5e5e61] text-[14px] font-medium leading-[20px]">
            You have completed the Application successfully.<br />
            Thank you for your time and care.
          </p>

          {canRejoin && !asBackground && (
            <button
              onClick={handleRejoinClick}
              className="mt-4 bg-orange-450 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              REJOIN
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
