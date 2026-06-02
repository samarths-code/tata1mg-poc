import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import Tata1mgLogo from "../Tata1mgLogo";
import { useMeetingStore } from "../../store/meetingStore";

/**
 * Post-consultation "Thank You" screen (Figma 18/28/60/61).
 * Doctor variant gets a "Return to Dashboard" action; the patient variant does not.
 */
export function LeaveScreen({ setIsMeetingLeft }) {
  const isDoctor = useMeetingStore((s) => s.isDoctor);
  const heading = isDoctor ? "Thank You, Doctor!" : "Thank You!";

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Logo */}
      <div className="px-6 md:px-10 pt-6">
        <Tata1mgLogo dark />
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircleIcon className="w-6 h-6 text-[#16A34A]" />
          <span className="text-[#16A34A] text-sm font-semibold">Consultation Completed</span>
        </div>

        <h1 className="text-black text-3xl md:text-4xl font-semibold mb-3">{heading}</h1>

        <p className="text-[#5E5E61] text-sm md:text-base max-w-md leading-relaxed">
          You have completed the consultation successfully. Thank you for your time and care.
        </p>

        {isDoctor && (
          <button
            onClick={() => setIsMeetingLeft(false)}
            className="mt-7 bg-orange-450 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors"
          >
            Return to Dashboard
          </button>
        )}
      </div>

      {/* Security footer */}
      <div className="flex items-center justify-center gap-2.5 text-[#5e5e61] text-sm font-medium pb-6">
        <ShieldCheckIcon className="w-4 h-4 shrink-0" />
        <p>Your meeting is secure and encrypted. No one can join unless they are invited.</p>
      </div>
    </div>
  );
}
