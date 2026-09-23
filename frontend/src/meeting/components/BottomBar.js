import { useMediaDevice, useMeeting } from "@videosdk.live/react-sdk";
import React, { Fragment, useEffect, useRef, useState } from "react";
import { ChevronUpIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";
import useIsTab from "../../hooks/useIsTab";
import useIsMobile from "../../hooks/useIsMobile";
import { participantModes } from "../../utils/common";
import { Popover, Transition } from "../../lib/headless";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import { toast } from "react-toastify";
import { nameTructed, trimSnackBarText } from "../../utils/helper";
import VerificationPendingModal from "../../components/doctor/VerificationPendingModal";
import ImageCaptureButton from "../../components/doctor/ImageCaptureButton";
import NetworkStatsButton from "../../components/doctor/NetworkStatsButton";
import { stopVirtualBackground } from "../../lib/virtualBackground";
import { createAudioTrack, createVideoTrack } from "../../hooks/useMediaStream";

// Dark pill-style device button matching Figma design
function PillBtn({ onToggle, icon: Icon, iconOn, micActive = true, children, disabled }) {
  return (
    <div
      className="flex items-center h-8 bg-[#1b1b1e] border border-[#303033] rounded-lg pl-1 pr-2 py-1 relative"
      style={{
        boxShadow: "inset -1px -1px 1px 0px rgba(0,0,0,0.25)",
        filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.25))",
      }}
    >
      <button
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center justify-center p-1 rounded shrink-0"
      >
        {iconOn
          ? <Icon style={{ color: "white", height: 16, width: 16 }} fillcolor="white" />
          : <Icon style={{ color: "white", height: 16, width: 16 }} fillcolor="white" />
        }
      </button>
      {children}
    </div>
  );
}

// Device list popover panel
function DevicePanel({ devices, selectedId, label, onSelect }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
      <div className="bg-[#1b1b1e] border border-[#303033] rounded-lg py-1">
        <p className="ml-3 px-3 pt-2 pb-0 text-xs text-[#919093] uppercase tracking-wide">{label}</p>
        <div className="flex flex-col mt-1">
          {devices.map(({ deviceId, label: devLabel }, i) => (
            <button
              key={deviceId}
              className={`flex w-full text-left px-4 py-1.5 text-sm text-white hover:bg-[rgba(255,255,255,0.05)] ${deviceId === selectedId ? "bg-[rgba(255,255,255,0.08)]" : ""}`}
              onClick={() => onSelect(deviceId)}
            >
              {devLabel || `${label} ${i + 1}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MicBTN = () => {
  const mMeeting = useMeeting();
  const { selectedMicrophone, setSelectedMicroPhone, isMicrophonePermissionAllowed } = useMeetingAppContext();
  const { getMicrophones } = useMediaDevice();
  const [mics, setMics] = useState([]);
  const localMicOn = mMeeting?.localMicOn;

  // Fixed 16×16 inline icon — only the path changes on toggle, so there is no
  // layout shift (the old MicOnIcon/MicOffIcon components had different widths).
  const MicIcon = () =>
    localMicOn ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#95959E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );

  return (
    <PillBtn
      onToggle={() => mMeeting.toggleMic()}
      icon={MicIcon}
      iconOn={localMicOn}
      micActive={localMicOn}
      disabled={!isMicrophonePermissionAllowed}
    >
      <Popover className="relative">
        {({ close }) => (
          <>
            <Popover.Button
              disabled={!isMicrophonePermissionAllowed}
              className="flex items-center justify-center"
              onClick={() => getMicrophones().then((m) => m?.length && setMics(m))}
            >
              <ChevronUpIcon className="h-4 w-4 text-white" />
            </Popover.Button>
            <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
              <Popover.Panel className="absolute left-1/2 bottom-full z-10 w-64 -translate-x-1/2 pb-2">
                <DevicePanel
                  devices={mics}
                  selectedId={selectedMicrophone?.id}
                  label="Microphone"
                  onSelect={async (id) => {
                    close();
                    setSelectedMicroPhone({ id });
                    const track = await createAudioTrack(id);
                    if (track) mMeeting.changeMic(track);
                  }}
                />
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </PillBtn>
  );
};

export const OutputMicBTN = () => {
  const { muteSpeaker, setMuteSpeaker, setSelectedSpeaker, selectedSpeaker, isMicrophonePermissionAllowed } = useMeetingAppContext();
  const { getPlaybackDevices } = useMediaDevice();
  const [outputmics, setOutputMics] = useState([]);

  // muteSpeaker === true means the speaker is ON (audio audible). Swap to a
  // muted icon when off — same 16×16 box so there is no layout shift.
  const VolumeIcon = () =>
    muteSpeaker ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#95959E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );

  return (
    <div
      className="flex items-center h-8 bg-[#1b1b1e] border border-[#303033] rounded-lg pl-1 pr-2 py-1 relative"
      style={{ boxShadow: "inset -1px -1px 1px 0px rgba(0,0,0,0.25)", filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.25))" }}
    >
      <button
        onClick={() => setMuteSpeaker(!muteSpeaker)}
        className="flex items-center justify-center p-1 rounded shrink-0"
        disabled={!isMicrophonePermissionAllowed}
      >
        <VolumeIcon />
      </button>
      <Popover className="relative">
        {({ close }) => (
          <>
            <Popover.Button
              disabled={!isMicrophonePermissionAllowed}
              className="flex items-center justify-center"
              onClick={() => getPlaybackDevices().then((d) => d?.length && setOutputMics(d))}
            >
              <ChevronUpIcon className="h-4 w-4 text-white" />
            </Popover.Button>
            {outputmics.length > 0 && (
              <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                <Popover.Panel style={{ zIndex: 9999 }} className="absolute left-1/2 bottom-full w-64 -translate-x-1/2 pb-2">
                  <DevicePanel
                    devices={outputmics}
                    selectedId={selectedSpeaker?.id}
                    label="Speaker"
                    onSelect={(id) => { setSelectedSpeaker({ id }); setTimeout(() => close(), 200); }}
                  />
                </Popover.Panel>
              </Transition>
            )}
          </>
        )}
      </Popover>
    </div>
  );
};

export const WebCamBTN = () => {
  const mMeeting = useMeeting();
  const { getCameras } = useMediaDevice();
  const { selectedWebcam, setSelectedWebcam, isCameraPermissionAllowed, isAudioOnly } = useMeetingAppContext();
  const [webcams, setWebcams] = useState([]);
  const localWebcamOn = mMeeting?.localWebcamOn;

  if (isAudioOnly) return null;

  // Video SVG icon — swaps to a slashed/muted icon when the camera is off.
  const VideoIcon = () =>
    localWebcamOn ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#95959E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );

  return (
    <div
      className="flex items-center h-8 bg-[#1b1b1e] border border-[#303033] rounded-lg pl-1 pr-2 py-1 relative"
      style={{ boxShadow: "inset -1px -1px 1px 0px rgba(0,0,0,0.25)", filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.25))" }}
    >
      <button
        onClick={async () => {
          // Same 480p track (+ agent background) as pre-call and join.
          const track = localWebcamOn ? undefined : await createVideoTrack(selectedWebcam?.id);
          mMeeting.toggleWebcam(track);
          // Camera going off — release the background processor too.
          if (localWebcamOn) stopVirtualBackground();
        }}
        className="flex items-center justify-center p-1 rounded shrink-0"
        disabled={!isCameraPermissionAllowed}
      >
        <VideoIcon />
      </button>
      <Popover className="relative">
        {({ close }) => (
          <>
            <Popover.Button
              disabled={!isCameraPermissionAllowed}
              className="flex items-center justify-center"
              onClick={() => getCameras().then((c) => c?.length && setWebcams(c))}
            >
              <ChevronUpIcon className="h-4 w-4 text-white" />
            </Popover.Button>
            <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
              <Popover.Panel className="absolute left-1/2 bottom-full z-10 w-64 -translate-x-1/2 pb-2">
                <DevicePanel
                  devices={webcams}
                  selectedId={selectedWebcam?.id}
                  label="Webcam"
                  onSelect={async (id) => {
                    close();
                    setSelectedWebcam({ id });
                    // Swap in place — no disable/enable gap for the other side.
                    const track = await createVideoTrack(id);
                    if (track) mMeeting.changeWebcam(track);
                  }}
                />
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  );
};

// Call duration timer
export function useCallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function LeaveBTN({ isDoctor, completedStepsRef, completedSteps, showLeaveModal, setShowLeaveModal }) {
  const { leave, end, localParticipant } = useMeeting();

  const allVerified = !isDoctor || completedStepsRef.current.includes(1);

  const performLeave = () => {
    const name = trimSnackBarText(nameTructed(localParticipant.displayName, 15));
    if (isDoctor) {
      toast(`${name} ended the Application.`, {
        position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, pauseOnHover: true, draggable: true, theme: "dark",
      });
      end();
    } else {
      toast(`${name} left the meeting.`, {
        position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, pauseOnHover: true, draggable: true, theme: "dark",
      });
      leave();
    }
  };

  return (
    <>
      <button
        onClick={() => allVerified ? performLeave() : setShowLeaveModal(true)}
        className="bg-[#991b1b] text-[#fecaca] font-medium text-sm px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-[#7f1d1d] transition-colors"
      >
        End Call
      </button>
      {showLeaveModal && (
        <VerificationPendingModal
          completedSteps={completedSteps}
          onLeaveAnyway={() => { setShowLeaveModal(false); performLeave(); }}
          onClose={() => setShowLeaveModal(false)}
        />
      )}
    </>
  );
}

export function BottomBar({ bottomBarHeight, onShowConnectionDetails, completedSteps = [], customerId = null }) {
  const { participantMode, isAudioOnly } = useMeetingAppContext((s) => ({
    participantMode: s.participantMode,
    isAudioOnly: s.isAudioOnly,
  }));

  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  const isMobile = useIsMobile();
  const isTab = useIsTab();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const timer = useCallTimer();

  // Ref so LeaveBTN always reads the latest completedSteps regardless of closure staleness
  const completedStepsRef = useRef(completedSteps);
  useEffect(() => { completedStepsRef.current = completedSteps; }, [completedSteps]);

  function getBrowserName(ua) {
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("SamsungBrowser")) return "SamsungBrowser";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "unknown";
  }
  const browserName = getBrowserName(navigator.userAgent);
  const supportsOutputDevice = browserName === "Chrome" || browserName === "Edge" || browserName === "Opera";

  // Agent-only video tools. (Virtual background is chosen on the pre-call
  // screen only; it stays applied for the whole call.)
  const showCapture = isDoctor && !isAudioOnly;

  const leaveButton = (
    <LeaveBTN isDoctor={isDoctor} completedStepsRef={completedStepsRef} completedSteps={completedSteps} showLeaveModal={showLeaveModal} setShowLeaveModal={setShowLeaveModal} />
  );

  // Mobile / tablet layout — Figma floating pill: black bg, rounded-t-[24px]
  if (isMobile || isTab) {
    return (
      <div
        style={{
          backgroundColor: "#000000",
          borderTop: "1px solid rgba(255,255,255,0.2)",
          borderLeft: "1px solid rgba(255,255,255,0.2)",
          borderRight: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "24px 24px 0 0",
        }}
      >
        {/* Controls row: all items centered as one group */}
        <div className="flex items-center justify-center gap-2 px-4 py-5">
          <span className="text-[#919093] text-sm font-normal w-[46px] text-center tabular-nums shrink-0">{timer}</span>
          <MicBTN />
          <OutputMicBTN />
          <WebCamBTN />
          {showCapture && <ImageCaptureButton customerId={customerId} />}
          {isDoctor && <NetworkStatsButton customerId={customerId} />}
          {leaveButton}
        </div>
      </div>
    );
  }

  // Desktop layout — Figma floating pill design
  return (
    <div
      className="flex items-center justify-center relative"
      style={{ height: bottomBarHeight }}
    >
      {/* Centered floating pill */}
      <div className="flex items-center justify-center bg-black border border-l border-r border-t border-[rgba(255,255,255,0.2)] rounded-3xl px-6 py-5">
        <div className="flex items-center gap-1.5">
          {/* Timer */}
          <span className="text-[#919093] text-sm font-normal w-[50px] shrink-0">{timer}</span>

          {/* Mic */}
          <MicBTN />

          {/* Volume */}
          {supportsOutputDevice && <OutputMicBTN />}

          {/* Webcam (hidden in audio-only calls) */}
          <WebCamBTN />

          {/* Agent: capture client image */}
          {showCapture && <ImageCaptureButton customerId={customerId} />}

          {/* Agent: transport-level network stats (audio + video calls) */}
          {isDoctor && <NetworkStatsButton customerId={customerId} />}

          {/* End Call */}
          <div className="ml-1">{leaveButton}</div>
        </div>
      </div>

      {/* Connection Details button — right side */}
      {typeof onShowConnectionDetails === "function" && (
        <button
          onClick={onShowConnectionDetails}
          className="absolute right-4 flex items-center gap-1.5 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          <ComputerDesktopIcon className="w-4 h-4" />
          <span>Connection Details</span>
        </button>
      )}
    </div>
  );
}
