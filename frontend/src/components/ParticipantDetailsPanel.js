import React from "react";
import { useMeeting, useParticipant } from "@videosdk.live/react-sdk";
import { XMarkIcon } from "@heroicons/react/24/outline";

function ParticipantRow({ index, participantId }) {
  const { displayName, micOn } = useParticipant(participantId);
  return (
    <div className="flex gap-2 items-center w-full">
      <div className="bg-[rgba(255,255,255,0.05)] flex items-center justify-center rounded-full w-6 h-6 shrink-0">
        <span className="text-white text-xs font-medium">{index}</span>
      </div>
      <span className="flex-1 text-white text-sm font-medium truncate min-w-0">{displayName}</span>
      {micOn && (
        <div
          className="border border-[#303033] flex gap-0.5 items-center p-1 rounded-lg shrink-0 relative bg-[#1b1b1e]"
          style={{
            boxShadow: "inset -1px -1px 1px 0px rgba(0,0,0,0.25), 0px 4px 2px rgba(0,0,0,0.25)",
          }}
        >
          <div className="bg-white h-[3px] w-0.5 rounded" />
          <div className="bg-white h-[3px] w-0.5 rounded" />
          <div className="bg-white h-[3px] w-0.5 rounded" />
        </div>
      )}
    </div>
  );
}

export function ParticipantDetailsPanel({ onClose }) {
  const { participants } = useMeeting();
  const allIds = [...participants.keys()].filter(
    (id) => participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  );

  return (
    <div className="flex flex-col h-full w-full md:w-[400px] bg-[#101113] border-l border-[rgba(255,255,255,0.05)] md:rounded-tl-[24px] md:rounded-bl-[24px]">
      {/* Header */}
      <div className="flex flex-col gap-2 p-5 shrink-0 w-full">
        <div className="flex gap-2.5 items-center w-full">
          <h2 className="flex-1 text-white text-lg font-semibold leading-[26px]">Participant Details</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center p-1 rounded-[6px] text-[#919093] hover:text-white transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[#919093] text-xs leading-4 w-full">
          Review device, network, location, and connected hardware information for this participant.
        </p>
      </div>
      <div className="bg-[rgba(255,255,255,0.03)] h-px w-full shrink-0" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="border border-[rgba(255,255,255,0.05)] rounded-xl p-2 flex flex-col gap-2 w-full">
          {/* Contributors header */}
          <div className="flex gap-2 items-center w-full">
            <span className="flex-1 text-white text-sm font-medium">Contributors</span>
            <span className="text-[#919093] text-xs font-medium">{allIds.length}</span>
          </div>
          <div className="bg-[rgba(255,255,255,0.05)] h-px w-full rounded-sm shrink-0" />
          {/* Rows */}
          {allIds.map((id, i) => (
            <ParticipantRow key={id} index={i + 1} participantId={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
