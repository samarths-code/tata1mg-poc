import React, { useState, useEffect, useRef } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { LockClosedIcon, EllipsisVerticalIcon, CheckCircleIcon as CheckCircleOutline } from "@heroicons/react/24/outline";
import useIsRecording from "../../hooks/useIsRecording";
import useIsMobile from "../../hooks/useIsMobile";

const STEPS = [
  { id: 1, label: "Connection Verification" },
  { id: 2, label: "Identity Verification" },
  { id: 3, label: "Face Match" },
];

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

// Step pill + hamburger rendered ABOVE the bottom bar on mobile (doctor only)
export function DoctorStepBar({ currentStep = 1, completedSteps = [], onStepClick }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef(null);
  const activeStep = STEPS.find((s) => s.id === currentStep) || STEPS[0];
  const isDone = completedSteps.includes(activeStep.id);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div className="flex gap-2 items-center" ref={menuRef}>
      <button
        onClick={() => onStepClick?.(activeStep.id)}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-[6px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded text-sm font-medium"
      >
        {isDone && <CheckCircleOutline className="w-4 h-4 text-[#22c55e] shrink-0" />}
        <span className={isDone ? "text-[#22c55e]" : "text-white"}>
          Step {activeStep.id}: {activeStep.label}
        </span>
      </button>

      {/* Hamburger — step list dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center justify-center p-[6px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded"
        >
          <EllipsisVerticalIcon className="w-5 h-5 text-white" />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 bottom-full mb-1 bg-[#1b1b1e] border border-white/5 rounded z-50 min-w-[240px] shadow-xl">
            <div className="flex flex-col gap-0.5 p-1">
              {STEPS.map((step) => {
                const done = completedSteps.includes(step.id);
                const locked = !done && step.id > currentStep;
                return (
                  <button
                    key={step.id}
                    disabled={locked}
                    onClick={() => { if (!locked) { onStepClick?.(step.id); setDropdownOpen(false); } }}
                    className={`flex items-center gap-2 h-7 px-2 py-1 w-full rounded-sm text-left ${locked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5 cursor-pointer"}`}
                  >
                    <span className="flex-1 text-sm text-white truncate">Step {step.id}: {step.label}</span>
                    {done ? <CheckCircleIcon className="w-4 h-4 text-[#22c55e] shrink-0" />
                      : locked ? <LockClosedIcon className="w-3.5 h-3.5 text-white/40 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DoctorTopBar({
  meetingTitle,
  caseId,
  currentStep = 1,
  completedSteps = [],
  onStepClick,
}) {
  // All hooks must be called unconditionally — before any early return
  const isMobile = useIsMobile();
  const [time, setTime] = useState(getCurrentTime());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef(null);
  const isRecording = useIsRecording();
  const title = meetingTitle || (caseId ? `Case: ${caseId}` : "VKYC Application");
  const activeStep = STEPS.find((s) => s.id === currentStep) || STEPS[0];

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

  // Desktop: full bar with time + title + REC + step pill + hamburger

  return (
    <div className="flex items-center justify-between px-5 shrink-0 z-20 h-14">
      <div className="flex items-center gap-2 text-white min-w-0">
        <span className="text-base font-medium whitespace-nowrap">{time}</span>
        <div className="h-5 w-px bg-white/30 shrink-0" />
        <span className="text-base whitespace-nowrap overflow-hidden text-ellipsis">{title}</span>
        {isRecording && <RecBadge />}
      </div>

      <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
        {(() => {
          const isDone = completedSteps.includes(activeStep.id);
          return (
            <button
              onClick={() => onStepClick?.(activeStep.id)}
              className="bg-white/[0.02] border border-white/5 flex items-center gap-1.5 px-3 py-[6px] rounded-[4px] hover:bg-white/5 transition-colors cursor-pointer"
            >
              {isDone && <CheckCircleOutline className="w-4 h-4 text-[#22c55e] shrink-0" />}
              <span className={`text-sm font-medium whitespace-nowrap ${isDone ? "text-[#22c55e]" : "text-white"}`}>
                Step {activeStep.id}: {activeStep.label}
              </span>
            </button>
          );
        })()}
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
                  const isLocked = !isDone && step.id > currentStep;
                  return (
                    <button
                      key={step.id}
                      disabled={isLocked}
                      onClick={() => { if (!isLocked) { onStepClick?.(step.id); setDropdownOpen(false); } }}
                      className={`flex items-center gap-2 h-7 px-2 py-1 w-full rounded-sm transition-colors text-left ${isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5 cursor-pointer"}`}
                    >
                      <span className="flex-1 text-sm text-white truncate">Step {step.id}: {step.label}</span>
                      {isDone ? <CheckCircleIcon className="w-4 h-4 text-[#22c55e] shrink-0" />
                        : isLocked ? <LockClosedIcon className="w-3.5 h-3.5 text-white/40 shrink-0" /> : null}
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
