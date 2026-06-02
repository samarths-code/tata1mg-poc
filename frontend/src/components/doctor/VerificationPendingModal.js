import { XMarkIcon } from "@heroicons/react/24/outline";

const STEPS = [
  { id: 1, label: "Connection Verification" },
  { id: 2, label: "Identity Verification" },
  { id: 3, label: "Face Match" },
];

export default function VerificationPendingModal({ completedSteps = [], onLeaveAnyway, onClose }) {
  const pending = STEPS.filter((s) => !completedSteps.includes(s.id));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[5px]"
        onClick={onClose}
      />

      {/* Modal — 611px wide, matches Figma */}
      <div className="relative bg-neutral-950 border border-white/5 rounded-[24px] w-[611px] max-w-[95vw] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex flex-col gap-2 p-5">
          <div className="flex items-center gap-2.5">
            <h2 className="flex-1 text-[18px] font-semibold text-white leading-[26px]">
              Verification Pending
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center p-1 rounded-[6px] hover:bg-white/5 transition-colors"
            >
              <XMarkIcon className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
          <p className="text-xs text-neutral-400 leading-4">
            You cannot leave or end the consultation until all required verification steps are completed successfully.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.03]" />

        {/* Content */}
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-white leading-5">
              Please complete the following mandatory verification steps to continue:
            </p>
            {pending.map((step) => (
              <div key={step.id} className="flex items-center gap-1">
                <span className="w-6 h-6 flex items-center justify-center shrink-0">
                  <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                    <circle cx="3" cy="3" r="3" fill="white" fillOpacity="0.7" />
                  </svg>
                </span>
                <p className="text-sm text-white leading-5">Step {step.id}: {step.label}</p>
              </div>
            ))}
            <p className="text-sm text-white leading-5 mt-1">
              The consultation can only be completed after all verification steps are verified successfully.
            </p>
          </div>

          {/* Warning notice */}
          <div className="bg-red-800/10 border border-white/5 rounded-[8px] flex gap-2 items-start pl-3 pr-2 py-2">
            {/* Octagon-alert icon */}
            <svg
              className="w-4 h-4 text-red-200 shrink-0 mt-0.5"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-white leading-5">
              Please complete all pending steps before leaving the session.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.03]" />

        {/* Footer */}
        <div className="p-5">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onLeaveAnyway}
              className="bg-white/5 text-white text-sm font-medium px-3 py-[6px] rounded-[4px] hover:bg-white/10 transition-colors"
            >
              Leave Anyway
            </button>
            <button
              onClick={onClose}
              className="bg-orange-450 text-white text-sm font-medium px-3 py-[6px] rounded-[4px] hover:bg-orange-500 transition-colors"
            >
              Complete Verification
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
