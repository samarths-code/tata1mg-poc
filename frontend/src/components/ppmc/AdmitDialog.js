/**
 * AdmitDialog — shown to the PPMC doctor when a patient requests entry.
 * Wired to VideoSDK's onEntryRequested callback in MeetingContainer.
 * PPMC-exclusive; MER flow never sets an entryRequest.
 */
import React from "react";

const AdmitDialog = ({ request, onAllow, onDeny }) => {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
        <div className="text-4xl mb-3">👤</div>
        <p className="text-lg font-semibold text-gray-800 mb-1">Patient wants to join</p>
        <p className="text-sm text-gray-500 mb-6 truncate">
          {request.name || request.participantId}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDeny}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onAllow}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
          >
            Admit
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdmitDialog;
