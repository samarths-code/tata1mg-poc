import React, { useState, useEffect, useRef } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { LockClosedIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";

const STEPS = [
  { id: 1, label: "Connection Verification" },
  { id: 2, label: "Identity Verification" },
  { id: 3, label: "Face Match" },
];

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function DoctorTopBar({
  meetingTitle,
  caseId,
  currentStep = 1,
  completedSteps = [],
  onStepClick,
}) {
  const [time, setTime] = useState(getCurrentTime());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const title = meetingTitle || (caseId ? `Case: ${caseId}` : "Monthly Health Consultation & Wellness Checkup");
  const activeStep = STEPS.find((s) => s.id === currentStep) || STEPS[0];

  return (
    <div className="flex items-center justify-between px-5 shrink-0 z-20 h-14">
      {/* Left: time · title */}
      <div className="flex items-center gap-2 text-white min-w-0">
        <span className="text-base font-medium whitespace-nowrap">{time}</span>
        <div className="h-5 w-px bg-white/30 shrink-0" />
        <span className="text-base whitespace-nowrap overflow-hidden text-ellipsis">{title}</span>
      </div>

      {/* Right: active step pill + hamburger */}
      <div className="flex items-center gap-2 shrink-0" ref={menuRef}>

        {/* Current active step pill — clickable to open drawer or capture overlay */}
        <button
          onClick={() => onStepClick?.(activeStep.id)}
          className="bg-white/[0.02] border border-white/5 flex items-center px-3 py-[6px] rounded-[4px] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white whitespace-nowrap">
            Step {activeStep.id}: {activeStep.label}
          </span>
        </button>

        {/* Hamburger — shows all steps, locks future ones */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="bg-white/[0.02] border border-white/5 flex items-center justify-center p-[6px] rounded-[4px] hover:bg-white/5 transition-colors"
          >
            <EllipsisVerticalIcon className="w-5 h-5 text-white" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#1b1b1e] border border-white/5 rounded-[4px] z-50 min-w-[240px] shadow-xl">
              <div className="flex flex-col gap-0.5 p-1">
                {STEPS.map((step) => {
                  const isDone = completedSteps.includes(step.id);
                  // A step is reachable only if it's done, active, or the next unlocked step
                  const isLocked = !isDone && step.id > currentStep;

                  return (
                    <button
                      key={step.id}
                      disabled={isLocked}
                      onClick={() => {
                        if (!isLocked) {
                          onStepClick?.(step.id);
                          setDropdownOpen(false);
                        }
                      }}
                      className={`flex items-center gap-2 h-7 px-2 py-1 w-full rounded-sm transition-colors text-left ${
                        isLocked
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-white/5 cursor-pointer"
                      }`}
                    >
                      <span className="flex-1 text-sm text-white truncate">
                        Step {step.id}: {step.label}
                      </span>
                      {isDone ? (
                        <CheckCircleIcon className="w-4 h-4 text-[#22c55e] shrink-0" />
                      ) : isLocked ? (
                        <LockClosedIcon className="w-3.5 h-3.5 text-white/40 shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
