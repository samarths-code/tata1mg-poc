import React, { useState } from "react";
import { useMeeting } from "@videosdk.live/react-sdk";
import useIsRecording from "../hooks/useIsRecording";
import { RecBadge } from "./doctor/DoctorTopBar";
import MemorizedParticipantView from "../meeting/components/ParticipantView";
import {
  MicBTN,
  OutputMicBTN,
  WebCamBTN,
  useCallTimer,
} from "../meeting/components/BottomBar";
import { ParticipantDetailsPanel } from "./ParticipantDetailsPanel";
import ConnectionStatusOverlay from "./screens/ConnectionStatusOverlay";

export default function MobileCustomerCallView({ meetingTitle, statusMessage }) {
  const { leave, localParticipant, participants } = useMeeting();
  const isRecording = useIsRecording();
  const timer = useCallTimer();
  const [showPanel, setShowPanel] = useState(false);

  const handleLeave = () => { leave(); };

  // Remote participants excluding self and silent recorder bot
  const remoteIds = [...participants.keys()].filter((id) => {
    const p = participants.get(id);
    return id !== localParticipant?.id && p?.displayName?.toLowerCase() !== "recorder";
  });
  const isWaiting = remoteIds.length === 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#1b1b1e]">

      {/* ── Title + REC badge ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-4 pt-[59px] shrink-0">
        <p className="flex-1 text-white text-sm font-medium leading-5 pr-2 line-clamp-2">
          {meetingTitle || "Application"}
        </p>
        {isRecording && <RecBadge />}
      </div>

      {/* ── Video card ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative mx-4 mt-2 mb-2 rounded-[24px] overflow-hidden">

        {/* Side-by-side tiles; shows its own waiting card until the doctor joins */}
        <div className="absolute inset-0 flex flex-row">
          <MemorizedParticipantView />
        </div>

        {/* Reconnecting overlay — only for transient errors, not the normal waiting state */}
        {!isWaiting && <ConnectionStatusOverlay message={statusMessage} />}
      </div>

      {/* ── Status row: "Verification is Pending" + "⋮" menu ────────────── */}
      <div className="mx-4 mb-2 shrink-0 flex gap-2 items-center">
        <button
          onClick={() => setShowPanel(true)}
          className="flex-1 flex items-center justify-center px-3 py-[6px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[4px] text-white text-sm font-medium"
        >
          Participant Details
        </button>
      </div>

      {/* ── Controls drawer (black pill) ─────────────────────────────────── */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: "#000000",
          borderTop: "1px solid rgba(255,255,255,0.2)",
          borderLeft: "1px solid rgba(255,255,255,0.2)",
          borderRight: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "24px 24px 0 0",
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 20,
          paddingBottom: 20,
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-[#919093] text-sm font-normal w-[46px] text-center tabular-nums shrink-0">
            {timer}
          </span>
          <MicBTN />
          <OutputMicBTN />
          <WebCamBTN />
          <button
            onClick={handleLeave}
            className="bg-[#991b1b] font-medium text-sm px-3 py-[6px] rounded-lg whitespace-nowrap"
            style={{ color: "#fecaca" }}
          >
            End Call
          </button>
        </div>
      </div>

      {/* ── Participant details panel (full-screen slide-up) ──────────────── */}
      {showPanel && (
        <div className="fixed inset-0 z-50 bg-[#1b1b1e]">
          <ParticipantDetailsPanel onClose={() => setShowPanel(false)} />
        </div>
      )}
    </div>
  );
}
