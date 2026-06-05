import { useState } from "react";
import { useMeeting } from "@videosdk.live/react-sdk";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import { participantModes } from "../utils/common";
import { MemoizedParticipant } from "./ParticipantView";
import { PromoInfographic } from "./PromoInfographic";
import useIsMobile from "../hooks/useIsMobile";
import useIsTab from "../hooks/useIsTab";

function PipLayout({ participantIds, statusMessage }) {
  const [switchParticipants, setSwitchParticipants] = useState(false);
  const { participantMode } = useMeetingAppContext();
  const { localParticipant } = useMeeting();
  const isMobile = useIsMobile();
  const isTab = useIsTab();
  const isSmall = isMobile || isTab;

  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  // Hide SD/HD controls for patient on mobile — Figma has no resolution picker in patient view
  const showMainResolution = isDoctor || !isMobile;

  const mainId = participantIds.length > 1
    ? participantIds[switchParticipants ? 0 : 1]
    : participantIds[0];

  const pipId = participantIds.length > 1
    ? participantIds[switchParticipants ? 1 : 0]
    : null;

  // ── Desktop customer waiting state (Figma 200-6004) ───────────────────────
  // When only the local participant is in the meeting, show a dark centered card
  // with the status text and the self-view in a PiP — instead of showing the
  // local video full-bleed with an overlay on top.
  if (!isSmall && !isDoctor && participantIds.length === 1) {
    return (
      <div className="relative flex-1 min-w-0 h-full">
        {/* Main card — dark bg with margins so dark outer bg is visible */}
        <div className="absolute inset-3 rounded-[24px] overflow-hidden bg-[#303033] flex items-center justify-center">
          <p
            className="text-white text-2xl font-medium text-center px-8"
            style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
          >
            {statusMessage || "Waiting for Other Participant..."}
          </p>
        </div>

        {/* Self PiP — bottom-right inside the card */}
        <div className="absolute z-10 bottom-7 right-7 w-[275px] h-[150px] rounded-[24px] border border-[#ff6f61] overflow-hidden">
          <MemoizedParticipant
            participantId={participantIds[0]}
            isPip={true}
            showImageCapture={false}
            showResolution={false}
          />
          <p
            className="absolute bottom-[9px] left-[14px] text-white text-xs font-medium pointer-events-none"
            style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
          >
            {localParticipant?.displayName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-w-0 h-full">

      {/* Main video — inset on desktop so dark background is visible around card */}
      <div className={`absolute rounded-[24px] overflow-hidden ${isSmall ? "inset-0" : "inset-3"}`}>
        {mainId === "NULL" ? (
          <PromoInfographic />
        ) : (
          <MemoizedParticipant
            participantId={mainId}
            key={mainId}
            showImageCapture={isDoctor}
            showResolution={showMainResolution}
          />
        )}
        {/* Reconnecting overlay — rendered inside the card on desktop */}
        {!isSmall && statusMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <p className="text-white text-2xl font-medium drop-shadow-lg select-none">
              {statusMessage}
            </p>
          </div>
        )}
      </div>

      {/* PiP — local user, bottom-right, orange border */}
      {pipId && pipId !== "NULL" && (
        <div
          className={`absolute z-10 border border-[#ff6f61] overflow-hidden cursor-pointer ${
            isSmall
              ? "w-[130px] h-[170px] bottom-3 right-3 rounded-[16px]"
              : "w-[275px] h-[150px] bottom-7 right-7 rounded-[24px]"
          }`}
          onClick={() => setSwitchParticipants((s) => !s)}
        >
          <MemoizedParticipant
            participantId={pipId}
            key={pipId}
            isPip={true}
            showImageCapture={false}
            showResolution={false}
          />
        </div>
      )}
    </div>
  );
}

export default PipLayout;
