import { useState } from "react";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import { participantModes } from "../utils/common";
import { MemoizedParticipant } from "./ParticipantView";
import { PromoInfographic } from "./PromoInfographic";
import useIsMobile from "../hooks/useIsMobile";
import useIsTab from "../hooks/useIsTab";

function PipLayout({ participantIds }) {
  const [switchParticipants, setSwitchParticipants] = useState(false);
  const { participantMode } = useMeetingAppContext();
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

  return (
    <div className="relative flex-1 min-w-0 h-full">

      {/* Main video — fills the entire container */}
      <div className="absolute inset-0 rounded-[24px] overflow-hidden">
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
      </div>

      {/* PiP — local user, bottom-right, orange border */}
      {pipId && pipId !== "NULL" && (
        <div
          className={`absolute z-10 border border-[#ff6f61] overflow-hidden cursor-pointer ${
            isSmall
              ? "w-[130px] h-[170px] bottom-3 right-3 rounded-[16px]"
              : "w-[275px] h-[150px] bottom-4 right-4 rounded-[24px]"
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
