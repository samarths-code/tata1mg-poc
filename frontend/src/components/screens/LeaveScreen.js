import React, { useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { useMeetingStore } from "../../store/meetingStore";

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function StarRating() {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const active = hovered || rating;

  return (
    <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,0.05)] rounded-[24px] w-[400px] max-w-[calc(100vw-48px)] overflow-hidden">
      <div className="px-5 pt-5 pb-0 flex items-start justify-between">
        <div>
          <h3 className="text-black text-lg font-semibold leading-[26px]">
            How was your experience?
          </h3>
          <p className="text-[#919093] text-xs leading-4 mt-2">
            Your feedback helps us improve.
          </p>
        </div>
      </div>

      <div className="px-5 pt-4 pb-0 flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(star)}
            className="w-10 h-10 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
          >
            {star <= active ? (
              <StarSolid className="w-8 h-8 text-[#FBBF24]" />
            ) : (
              <StarOutline className="w-8 h-8 text-[#C7C6C9]" />
            )}
          </button>
        ))}
      </div>

      {/* Fixed-height label row prevents layout shift on star click */}
      <div className="h-8 flex items-center justify-center">
        {rating > 0 && (
          <p className="text-xs text-[#919093]">{STAR_LABELS[rating]}</p>
        )}
      </div>
    </div>
  );
}

export function LeaveScreen({ participantName }) {
  const isDoctor = useMeetingStore((s) => s.isDoctor);
  const displayName = participantName || (isDoctor ? "Agent" : "Guest");

  // Rejoin the same session — the join params (meetingId/mode/token/participantId)
  // were preserved in the URL when leaving, so re-entering "/" with them rejoins.
  const rejoinUrl = (() => {
    const search = window.location.search;
    return new URLSearchParams(search).get("meetingId") ? "/" + search : null;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">

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

          {rejoinUrl && (
            <button
              onClick={() => { window.location.href = rejoinUrl; }}
              className="mt-4 bg-orange-450 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              REJOIN
            </button>
          )}
        </div>

        {/* Rating card */}
        <StarRating />

      </div>
    </div>
  );
}
