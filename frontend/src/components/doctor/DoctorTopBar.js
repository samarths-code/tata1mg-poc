import React, { useState, useEffect } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Doctor in-call top bar matching the Figma design.
 *  Left:  current time · meeting title
 *  Right: Step 1/2/3 pills (green check when completed, outlined when active) · kebab menu
 *
 * Steps map to the 3-stage verification model:
 *   1 → Connection Verification
 *   2 → Identity Verification
 *   3 → Face Verification
 */
const STEP_LABELS = {
  1: "Step 1: Connection Verification",
  2: "Step 2: Identity Verification",
  3: "Step 3: Face Verification",
};

export default function DoctorTopBar({
  meetingTitle,
  caseId,
  currentStep = 1,
  completedSteps = [],
  onStepClick,
  onMenuClick,
  // which step pills to render — Figma shows 1 pill on Step 1 screens, 2 pills on later screens
  visibleSteps = [1, 2, 3],
}) {
  const [time, setTime] = useState(getCurrentTime());
  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 30000);
    return () => clearInterval(id);
  }, []);

  const title = meetingTitle || (caseId ? `Case: ${caseId}` : "Monthly Health Consultation & Wellness Checkup");

  return (
    <div className="flex items-center justify-between px-5 shrink-0 z-20 h-14">
      {/* Left: time + title */}
      <div className="flex items-center gap-2 text-white min-w-0">
        <span className="text-base font-medium whitespace-nowrap">{time}</span>
        <div className="h-5 w-px bg-white/30 shrink-0" />
        <span className="text-base whitespace-nowrap overflow-hidden text-ellipsis">{title}</span>
      </div>

      {/* Right: step pills + kebab */}
      <div className="flex items-center gap-2 shrink-0">
        {visibleSteps.map((step) => {
          const isDone = completedSteps.includes(step);
          const isActive = currentStep === step;
          return (
            <button
              key={step}
              onClick={() => onStepClick?.(step)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white whitespace-nowrap transition-colors border ${
                isActive
                  ? "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.25)]"
                  : isDone
                  ? "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)]"
                  : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.04)] opacity-50"
              }`}
            >
              {isDone && <CheckCircleIcon className="w-4 h-4 text-[#86efac] shrink-0" />}
              {STEP_LABELS[step]}
            </button>
          );
        })}
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
        >
          <EllipsisVerticalIcon className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
