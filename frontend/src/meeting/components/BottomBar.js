import {
  createCameraVideoTrack,
  createScreenShareVideoTrack,
  useMediaDevice,
  useMeeting,
  usePubSub,
} from "@videosdk.live/react-sdk";
import React, { Fragment, useEffect, useRef, useState } from "react";
import {
  ClipboardIcon,
  CheckIcon,
  ChevronUpIcon,
  EllipsisHorizontalIcon,
  ClipboardDocumentListIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import WebcamOnIcon from "../../icons/Bottombar/WebcamOnIcon";
import WebcamOffIcon from "../../icons/Bottombar/WebcamOffIcon";
import ScreenShareIcon from "../../icons/Bottombar/ScreenShareIcon";
import ParticipantsIcon from "../../icons/Bottombar/ParticipantsIcon";
import EndIcon from "../../icons/Bottombar/EndIcon";
import useIsTab from "../../hooks/useIsTab";
import useIsMobile from "../../hooks/useIsMobile";
import { MobileIconButton } from "../../components/buttons/MobileIconButton";
import { participantModes, sideBarModes } from "../../utils/common";
import { Dialog, Popover, Transition } from "@headlessui/react";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import useMediaStream from "../../hooks/useMediaStream";
import { toast } from "react-toastify";
import { nameTructed, trimSnackBarText } from "../../utils/helper";
import SpeakerIcon from "../../icons/Bottombar/SpeakerIcon";
import SpeakerOffIcon from "../../icons/Bottombar/SpeakerOffIcon";

// Dark pill-style device button matching Figma design
function PillBtn({ onToggle, icon: Icon, iconOn, showVoiceBars, micActive = true, children, disabled }) {
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
      {showVoiceBars && (
        <div className="flex gap-0.5 items-center h-2.5 mr-1 shrink-0">
          <div className={`w-0.5 h-[3px] rounded-sm ${micActive ? "bg-white" : "bg-[#95959E]"}`} />
          <div className={`w-0.5 h-[3px] rounded-sm ${micActive ? "bg-white" : "bg-[#95959E]"}`} />
          <div className={`w-0.5 h-[3px] rounded-sm ${micActive ? "bg-white" : "bg-[#95959E]"}`} />
        </div>
      )}
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

const MicBTN = () => {
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
      showVoiceBars
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
                  onSelect={(id) => { setSelectedMicroPhone({ id }); mMeeting.changeMic(id); close(); }}
                />
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </PillBtn>
  );
};

const OutputMicBTN = () => {
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

const WebCamBTN = () => {
  const mMeeting = useMeeting();
  const { getCameras } = useMediaDevice();
  const { selectedWebcam, setSelectedWebcam, isCameraPermissionAllowed } = useMeetingAppContext();
  const [webcams, setWebcams] = useState([]);
  const localWebcamOn = mMeeting?.localWebcamOn;

  const { getVideoTrack } = useMediaStream();

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
          let track;
          if (!localWebcamOn) {
            track = await createCameraVideoTrack({
              cameraId: selectedWebcam?.id,
              optimizationMode: "motion",
              encoderConfig: "h180p_w320p",
              facingMode: "environment",
              multiStream: false,
            });
          }
          mMeeting.toggleWebcam(track);
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
                    setSelectedWebcam({ id });
                    mMeeting.disableWebcam();
                    setTimeout(async () => {
                      const track = await createCameraVideoTrack({ cameraId: id, optimizationMode: "motion", multiStream: false });
                      mMeeting.enableWebcam(track);
                    }, 500);
                    close();
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
function useCallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function BottomBar({ bottomBarHeight, onShowConnectionDetails }) {
  const { sideBarMode, setSideBarMode, participantMode } = useMeetingAppContext();

  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  const isMobile = useIsMobile();
  const isTab = useIsTab();
  const [open, setOpen] = useState(false);
  const timer = useCallTimer();

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

  const ScreenShareBTN = ({ isMobile, isTab }) => {
    const { localScreenShareOn, toggleScreenShare, presenterId } = useMeeting();
    return isMobile || isTab ? (
      <MobileIconButton
        id="screen-share-btn"
        tooltipTitle={presenterId ? (localScreenShareOn ? "Stop Presenting" : null) : "Present Screen"}
        buttonText={presenterId ? (localScreenShareOn ? "Stop Presenting" : null) : "Present Screen"}
        isFocused={localScreenShareOn}
        Icon={ScreenShareIcon}
        onClick={async () => {
          try {
            const track = await createScreenShareVideoTrack({ optimizationMode: "text", encoderConfig: "h720p_15fps" });
            toggleScreenShare(track);
          } catch (err) { console.error("Screen share error:", err); }
        }}
        disabled={presenterId ? !localScreenShareOn : isMobile}
      />
    ) : null;
  };

  const LeaveBTN = () => {
    const { leave, end, localParticipant } = useMeeting();
    return (
      <button
        onClick={() => {
          const name = trimSnackBarText(nameTructed(localParticipant.displayName, 15));
          // Doctor ends the meeting for everyone; others just leave.
          if (isDoctor) {
            toast(`${name} ended the consultation.`, {
              position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, pauseOnHover: true, draggable: true, theme: "light",
            });
            end();
          } else {
            toast(`${name} left the meeting.`, {
              position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, pauseOnHover: true, draggable: true, theme: "light",
            });
            leave();
          }
        }}
        className="bg-[#991b1b] text-[#fecaca] font-medium text-sm px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-[#7f1d1d] transition-colors"
      >
        End Call
      </button>
    );
  };

  const ParticipantsBTN = ({ isMobile, isTab }) => {
    const { participants } = useMeeting();
    return isMobile || isTab ? (
      <MobileIconButton
        tooltipTitle="Participants"
        isFocused={sideBarMode === sideBarModes.PARTICIPANTS}
        buttonText="Participants"
        disabledOpacity={1}
        Icon={ParticipantsIcon}
        onClick={() => setSideBarMode((s) => s === sideBarModes.PARTICIPANTS ? null : sideBarModes.PARTICIPANTS)}
        badge={`${new Map(participants)?.size}`}
      />
    ) : null;
  };

  const DocumentPanelBTN = ({ isMobile, isTab }) => {
    return isMobile || isTab ? (
      <MobileIconButton
        tooltipTitle="Documents"
        buttonText="Documents"
        Icon={ClipboardDocumentListIcon}
        isFocused={sideBarMode === sideBarModes.DOCUMENT_PANEL}
        onClick={() => setSideBarMode((s) => s === sideBarModes.DOCUMENT_PANEL ? null : sideBarModes.DOCUMENT_PANEL)}
      />
    ) : null;
  };

  const MeetingIdCopyBTN = () => {
    const { meetingId } = useMeeting();
    const [isCopied, setIsCopied] = useState(false);
    return (
      <div className="flex items-center justify-center">
        <div className="flex border border-[#303033] p-2 rounded-md items-center justify-center gap-2 bg-[#1b1b1e]">
          <span className="text-white text-sm font-mono">{meetingId}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(meetingId);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 3000);
            }}
          >
            {isCopied
              ? <CheckIcon className="h-4 w-4 text-green-400" />
              : <ClipboardIcon className="h-4 w-4 text-[#919093]" />
            }
          </button>
        </div>
      </div>
    );
  };

  const mobileFeatures = [
    "SCREEN_SHARE",
    "PARTICIPANTS",
    ...(isDoctor ? ["DOCUMENT_PANEL"] : []),
    "MEETING_ID_COPY",
  ];

  // Mobile / tablet layout — keep existing pattern
  if (isMobile || isTab) {
    return (
      <div
        className="flex items-center justify-center bg-[#1b1b1e] border-t border-[rgba(255,255,255,0.08)]"
        style={{ height: bottomBarHeight }}
      >
        <LeaveBTN />
        <div className="flex items-center gap-2 mx-4">
          <MicBTN />
          <WebCamBTN />
          {supportsOutputDevice && <OutputMicBTN />}
        </div>
        <button
          className="flex items-center justify-center p-2 rounded-lg bg-[rgba(255,255,255,0.05)]"
          onClick={() => setOpen(true)}
        >
          <EllipsisHorizontalIcon className="h-5 w-5 text-white" />
        </button>
        <Transition appear show={Boolean(open)} as={Fragment}>
          <Dialog as="div" className="relative" style={{ zIndex: 9999 }} onClose={() => setOpen(false)}>
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="translate-y-full opacity-0" enterTo="translate-y-0 opacity-100" leave="ease-in duration-200" leaveFrom="translate-y-0 opacity-100" leaveTo="translate-y-full opacity-0">
              <div className="fixed inset-0 overflow-y-hidden">
                <div className="flex h-full items-end justify-end text-center">
                  <Dialog.Panel className="w-screen transform overflow-hidden bg-[#1b1b1e] shadow-xl transition-all border-t border-[rgba(255,255,255,0.08)]">
                    <div className="grid container py-6">
                      <div className="grid grid-cols-12 gap-2">
                        {mobileFeatures.map((icon, index) => (
                          <div key={index} className={`grid items-center justify-center ${icon === "MEETING_ID_COPY" ? "col-span-7 sm:col-span-5" : "col-span-4 sm:col-span-3"}`}>
                            {icon === "SCREEN_SHARE" ? <ScreenShareBTN isMobile={isMobile} isTab={isTab} />
                              : icon === "PARTICIPANTS" ? <ParticipantsBTN isMobile={isMobile} isTab={isTab} />
                              : icon === "DOCUMENT_PANEL" ? <DocumentPanelBTN isMobile={isMobile} isTab={isTab} />
                              : icon === "MEETING_ID_COPY" ? <MeetingIdCopyBTN />
                              : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Dialog.Panel>
                </div>
              </div>
            </Transition.Child>
          </Dialog>
        </Transition>
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

          {/* Webcam */}
          <WebCamBTN />

          {/* End Call */}
          <div className="ml-1">
            <LeaveBTN />
          </div>
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
