import React, { useState } from "react";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import Tata1mgLogo from "../Tata1mgLogo";
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
  const displayName = participantName || (isDoctor ? "Doctor" : "Guest");

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden">

      {/* Logo — top-left, matches Figma top:30 left:30 */}
      <div className="absolute top-[30px] left-[30px]">
        <Tata1mgLogo dark />
      </div>

      {/* Text block — centered at exactly 50% of viewport height (Figma: top:50%) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                      flex flex-col items-center text-center gap-2 px-6 w-full">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-[#22c55e]" />
          <span className="text-[#5e5e61] text-sm font-medium">Consultation Completed</span>
        </div>

        <h1 className="text-black text-[24px] font-medium leading-[32px]">
          Thank You, {displayName}!
        </h1>

        <p className="text-[#5e5e61] text-[14px] font-medium leading-[20px]">
          You have completed the consultation successfully.<br />
          Thank you for your time and care.
        </p>

        {isDoctor && (
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-orange-450 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Return to Dashboard
          </button>
        )}
      </div>

      {/* Rating card — center is 246px below viewport midpoint (Figma: top:calc(50%+246px)) */}
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
           style={{ top: "calc(50% + 246px)" }}>
        <StarRating />
      </div>

      {/* Security footer — pinned to bottom (Figma: top:846px on 900px frame) */}
      <div className="absolute bottom-[30px] left-1/2 -translate-x-1/2
                      flex items-center gap-[10px] text-[#5e5e61] text-sm font-medium whitespace-nowrap">
        <ShieldCheckIcon className="w-4 h-4 shrink-0" />
        <p>Your meeting is secure and encrypted. No one can join unless they are invited.</p>
      </div>

    </div>
  );
}
