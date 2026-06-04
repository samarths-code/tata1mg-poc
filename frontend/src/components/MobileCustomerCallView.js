import React, { useState } from "react";
import { useMeeting } from "@videosdk.live/react-sdk";
import { toast } from "react-toastify";
import useIsRecording from "../hooks/useIsRecording";
import { RecBadge } from "./doctor/DoctorTopBar";
import MemorizedParticipantView from "../meeting/components/ParticipantView";
import {
  MicBTN,
  OutputMicBTN,
  WebCamBTN,
  useCallTimer,
} from "../meeting/components/BottomBar";
import { CustomerVerificationOverlay } from "./CustomerVerificationOverlay";
import { ParticipantDetailsPanel } from "./ParticipantDetailsPanel";
import ConnectionStatusOverlay from "./screens/ConnectionStatusOverlay";
import { nameTructed, trimSnackBarText } from "../utils/helper";

export default function MobileCustomerCallView({ meetingTitle, statusMessage }) {
  const { leave, localParticipant } = useMeeting();
  const isRecording = useIsRecording();
  const timer = useCallTimer();
  const [showPanel, setShowPanel] = useState(false);

  const handleLeave = () => {
    const name = trimSnackBarText(nameTructed(localParticipant?.displayName ?? "", 15));
    toast(`${name} left the meeting.`, {
      position: "bottom-left",
      autoClose: 4000,
      hideProgressBar: true,
      closeButton: false,
      pauseOnHover: true,
      draggable: true,
      theme: "dark",
    });
    leave();
  };

  return (
    // flex-1 min-h-0 fills remaining space in MeetingContainer's flex-col
    <div className="flex-1 min-h-0 flex flex-col bg-[#1b1b1e]">

      {/* ── Title + REC badge ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-4 pt-[59px] shrink-0">
        <p className="flex-1 text-white text-sm font-medium leading-5 pr-2 line-clamp-2">
          {meetingTitle || "Consultation"}
        </p>
        {isRecording && <RecBadge />}
      </div>

      {/* ── Video card: rounded, edge-to-edge except 16px margins ────────── */}
      {/* flex-1 min-h-0 ensures this grows to fill available space         */}
      <div className="flex-1 min-h-0 relative mx-4 mt-2 mb-2 rounded-[24px] overflow-hidden">
        {/* Video fills card absolutely so PiP stays inside rounded corners */}
        <div className="absolute inset-0 flex flex-row">
          <MemorizedParticipantView isPresenting={false} sideBarMode={null} />
        </div>
        {/* "Reconnecting…" / "Waiting for participant…" overlay */}
        <ConnectionStatusOverlay message={statusMessage} />
        {/* Document / face capture overlays triggered by doctor */}
        <CustomerVerificationOverlay />
      </div>

      {/* ── Participant Details pill (replaces step indicator) ────────────── */}
      <div className="mx-4 mb-2 shrink-0">
        <button
          onClick={() => setShowPanel(true)}
          className="w-full flex items-center justify-center px-3 py-[6px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded text-white text-sm font-medium"
        >
          Participant Details
        </button>
      </div>

      {/* ── Floating controls drawer (Figma: black pill, rounded-t-[24px]) ── */}
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
        {/* All controls centered as one group: timer | Mic | Speaker | Cam | End Call */}
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

      {/* ── Connection Details panel (full-screen slide-up) ──────────────── */}
      {showPanel && (
        <div className="fixed inset-0 z-50 bg-[#1b1b1e]">
          <ParticipantDetailsPanel onClose={() => setShowPanel(false)} />
        </div>
      )}
    </div>
  );
}
