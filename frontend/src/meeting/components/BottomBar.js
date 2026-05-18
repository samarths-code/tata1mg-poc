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
  ChevronDownIcon,
  EllipsisHorizontalIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import MicOnIcon from "../../icons/Bottombar/MicOnIcon";
import MicOffIcon from "../../icons/Bottombar/MicOffIcon";
import WebcamOnIcon from "../../icons/Bottombar/WebcamOnIcon";
import WebcamOffIcon from "../../icons/Bottombar/WebcamOffIcon";
import ScreenShareIcon from "../../icons/Bottombar/ScreenShareIcon";
import ParticipantsIcon from "../../icons/Bottombar/ParticipantsIcon";
import EndIcon from "../../icons/Bottombar/EndIcon";
import { OutlinedButton } from "../../components/buttons/OutlinedButton";
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
import { createPopper } from "@popperjs/core";

const MicBTN = () => {
  const mMeeting = useMeeting();
  const { selectedMicrophone, setSelectedMicroPhone, isMicrophonePermissionAllowed } = useMeetingAppContext();
  const { getMicrophones } = useMediaDevice();
  const [mics, setMics] = useState([]);
  const localMicOn = mMeeting?.localMicOn;

  const [tooltipShow, setTooltipShow] = useState(false);
  const btnRef = useRef();
  const tooltipRef = useRef();

  const openTooltip = () => {
    createPopper(btnRef.current, tooltipRef.current, { placement: "top" });
    setTooltipShow(true);
  };

  return (
    <>
      <OutlinedButton
        Icon={localMicOn ? MicOnIcon : MicOffIcon}
        onClick={() => mMeeting.toggleMic()}
        bgColor={localMicOn ? "bg-gray-750" : "bg-white"}
        borderColor={localMicOn && "#ffffff33"}
        isFocused={localMicOn}
        focusIconColor={localMicOn && "white"}
        tooltip="Toggle Mic"
        renderRightComponent={() => (
          <>
            <Popover className="relative">
              {({ close }) => (
                <>
                  <Popover.Button
                    disabled={!isMicrophonePermissionAllowed}
                    className="flex items-center justify-center mt-1 mr-1"
                  >
                    <div ref={btnRef} onMouseEnter={openTooltip} onMouseLeave={() => setTooltipShow(false)}>
                      <button onClick={() => getMicrophones().then((m) => m?.length && setMics(m))}>
                        <ChevronDownIcon className="h-4 w-4" style={{ color: localMicOn ? "white" : "black" }} />
                      </button>
                    </div>
                  </Popover.Button>
                  <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                    <Popover.Panel className="absolute left-1/2 bottom-full z-10 w-72 -translate-x-1/2 px-4 sm:px-0 pb-4">
                      <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                        <div className="bg-gray-750 py-1">
                          <p className="ml-3 p-3 pb-0 text-sm text-gray-900">MICROPHONE</p>
                          <div className="flex flex-col">
                            {mics.map(({ deviceId, label }, index) => (
                              <div key={deviceId} className={`px-2 py-1 my-1 pl-6 text-white text-left ${deviceId === selectedMicrophone.id && "bg-gray-150"}`}>
                                <button className={`flex flex-1 w-full text-left ${deviceId === selectedMicrophone.id && "bg-gray-150"}`} onClick={() => { setSelectedMicroPhone({ id: deviceId }); mMeeting.changeMic(deviceId); close(); }}>
                                  {label || `Mic ${index + 1}`}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>
            <div style={{ zIndex: 999 }} className={`${tooltipShow ? "" : "hidden"} overflow-hidden flex flex-col items-center justify-center pb-4`} ref={tooltipRef}>
              <div className="rounded-md p-1.5 bg-black"><p className="text-base text-white">Change microphone</p></div>
            </div>
          </>
        )}
      />
    </>
  );
};

const OutputMicBTN = () => {
  const { muteSpeaker, setMuteSpeaker, setSelectedSpeaker, selectedSpeaker, isMicrophonePermissionAllowed } = useMeetingAppContext();
  const { getPlaybackDevices } = useMediaDevice();
  const [outputmics, setOutputMics] = useState([]);

  const Icon = muteSpeaker ? SpeakerIcon : SpeakerOffIcon;

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <Popover.Button
            disabled={!isMicrophonePermissionAllowed}
            className={`flex items-center justify-center rounded-lg ${muteSpeaker ? "bg-gray-750 border-2 border-[#ffffff33] border-solid" : "bg-white border-2 border-transparent border-solid"} md:m-2 m-1`}
          >
            <button className="cursor-pointer flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setMuteSpeaker(!muteSpeaker); }}>
              <div className="flex items-center justify-center p-1 m-1 rounded-lg">
                <Icon style={{ color: muteSpeaker ? "white" : "#1C1F2E", height: 24, width: 24 }} fillcolor={muteSpeaker ? "white" : "#1C1F2E"} />
              </div>
            </button>
            <button className="mr-1" onClick={() => getPlaybackDevices().then((d) => d?.length && setOutputMics(d))}>
              <ChevronDownIcon className="h-4 w-4" style={{ color: muteSpeaker ? "white" : "black" }} />
            </button>
          </Popover.Button>
          {outputmics.length > 0 && (
            <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
              <Popover.Panel style={{ zIndex: 9999 }} className="absolute left-1/2 bottom-full w-72 -translate-x-1/2 px-4 sm:px-0 pb-2">
                <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="bg-gray-750 py-1">
                    <p className="ml-3 p-3 pb-0 text-sm text-gray-900">SPEAKER</p>
                    <div className="flex flex-col">
                      {outputmics.map(({ deviceId, label }, index) => (
                        <div key={deviceId} className={`px-3 py-1 my-1 pl-6 text-white text-left ${deviceId === selectedSpeaker.id && "bg-gray-150"}`}>
                          <button className={`flex flex-1 w-full ${deviceId === selectedSpeaker.id && "bg-gray-150"}`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSelectedSpeaker({ id: deviceId }); setTimeout(() => close(), 200); }}>
                            {label || `Speaker ${index + 1}`}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Popover.Panel>
            </Transition>
          )}
        </>
      )}
    </Popover>
  );
};

const WebCamBTN = () => {
  const mMeeting = useMeeting();
  const { getCameras } = useMediaDevice();
  const { selectedWebcam, setSelectedWebcam, isCameraPermissionAllowed } = useMeetingAppContext();
  const [webcams, setWebcams] = useState([]);
  const localWebcamOn = mMeeting?.localWebcamOn;

  const [tooltipShow, setTooltipShow] = useState(false);
  const btnRef = useRef();
  const tooltipRef = useRef();
  const openTooltip = () => {
    createPopper(btnRef.current, tooltipRef.current, { placement: "top" });
    setTooltipShow(true);
  };

  const { getVideoTrack } = useMediaStream();

  return (
    <>
      <OutlinedButton
        Icon={localWebcamOn ? WebcamOnIcon : WebcamOffIcon}
        onClick={async () => {
          let track;
          if (!localWebcamOn) {
            track = await createCameraVideoTrack({
              cameraId: selectedWebcam.id,
              optimizationMode: "motion",
              encoderConfig: "h180p_w320p",
              facingMode: "environment",
              multiStream: false,
            });
          }
          mMeeting.toggleWebcam(track);
        }}
        bgColor={localWebcamOn ? "bg-gray-750" : "bg-white"}
        borderColor={localWebcamOn && "#ffffff33"}
        isFocused={localWebcamOn}
        focusIconColor={localWebcamOn && "white"}
        tooltip="Toggle Webcam"
        renderRightComponent={() => (
          <>
            <Popover className="relative">
              {({ close }) => (
                <>
                  <Popover.Button
                    disabled={!isCameraPermissionAllowed}
                    className="flex items-center justify-center mt-1 mr-1"
                  >
                    <div ref={btnRef} onMouseEnter={openTooltip} onMouseLeave={() => setTooltipShow(false)}>
                      <button onClick={() => getCameras().then((c) => c?.length && setWebcams(c))}>
                        <ChevronDownIcon className="h-4 w-4" style={{ color: localWebcamOn ? "white" : "black" }} />
                      </button>
                    </div>
                  </Popover.Button>
                  <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                    <Popover.Panel className="absolute left-1/2 bottom-full z-10 w-72 -translate-x-1/2 px-4 sm:px-0 pb-4">
                      <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                        <div className="bg-gray-750 py-1">
                          <p className="ml-3 p-3 pb-0 text-sm text-gray-900">WEBCAM</p>
                          <div className="flex flex-col">
                            {webcams.map(({ deviceId, label }, index) => (
                              <div key={deviceId} className={`px-2 py-1 my-1 pl-6 text-white text-left ${deviceId === selectedWebcam.id && "bg-gray-150"}`}>
                                <button
                                  className={`flex flex-1 w-full text-left ${deviceId === selectedWebcam.id && "bg-gray-150"}`}
                                  onClick={async () => {
                                    setSelectedWebcam({ id: deviceId });
                                    mMeeting.disableWebcam();
                                    setTimeout(async () => {
                                      const track = await createCameraVideoTrack({ cameraId: deviceId, optimizationMode: "motion", multiStream: false });
                                      mMeeting.enableWebcam(track);
                                    }, 500);
                                    close();
                                  }}
                                >
                                  {label || `Webcam ${index + 1}`}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>
            <div style={{ zIndex: 999 }} className={`${tooltipShow ? "" : "hidden"} overflow-hidden flex flex-col items-center justify-center pb-4`} ref={tooltipRef}>
              <div className="rounded-md p-1.5 bg-black"><p className="text-base text-white">Change webcam</p></div>
            </div>
          </>
        )}
      />
    </>
  );
};

export function BottomBar({ bottomBarHeight }) {
  const { sideBarMode, setSideBarMode, participantMode } = useMeetingAppContext();

  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

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
    ) : (
      <OutlinedButton
        Icon={ScreenShareIcon}
        onClick={async () => {
          try {
            const track = await createScreenShareVideoTrack({ optimizationMode: "text", encoderConfig: "h720p_15fps" });
            toggleScreenShare(track);
          } catch (err) { console.error("Screen share error:", err); }
        }}
        isFocused={localScreenShareOn}
        tooltip={presenterId ? (localScreenShareOn ? "Stop Presenting" : null) : "Present Screen"}
        disabled={presenterId ? !localScreenShareOn : false}
      />
    );
  };

  const LeaveBTN = () => {
    const { leave, localParticipant } = useMeeting();
    return (
      <OutlinedButton
        Icon={EndIcon}
        bgColor="bg-red-150"
        onClick={() => {
          toast(
            `${trimSnackBarText(nameTructed(localParticipant.displayName, 15))} left the meeting.`,
            { position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, pauseOnHover: true, draggable: true, theme: "light" }
          );
          leave();
        }}
        tooltip="Leave Meeting"
      />
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
    ) : (
      <OutlinedButton
        Icon={ParticipantsIcon}
        onClick={() => setSideBarMode((s) => s === sideBarModes.PARTICIPANTS ? null : sideBarModes.PARTICIPANTS)}
        isFocused={sideBarMode === sideBarModes.PARTICIPANTS}
        tooltip="Participants"
        badge={`${new Map(participants)?.size}`}
      />
    );
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
    ) : (
      <OutlinedButton
        Icon={ClipboardDocumentListIcon}
        onClick={() => setSideBarMode((s) => s === sideBarModes.DOCUMENT_PANEL ? null : sideBarModes.DOCUMENT_PANEL)}
        isFocused={sideBarMode === sideBarModes.DOCUMENT_PANEL}
        tooltip="Documents"
      />
    );
  };

  const MeetingIdCopyBTN = () => {
    const { meetingId } = useMeeting();
    const [isCopied, setIsCopied] = useState(false);
    return (
      <div className="flex items-center justify-center lg:ml-0 ml-4">
        <div className="flex border-2 border-gray-850 p-2 rounded-md items-center justify-center">
          <h1 className="text-white text-base">{meetingId}</h1>
          <button
            className="ml-2"
            onClick={() => {
              navigator.clipboard.writeText(meetingId);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 3000);
            }}
          >
            {isCopied ? <CheckIcon className="h-5 w-5 text-green-550" /> : <ClipboardIcon className="h-5 w-5 text-white" />}
          </button>
        </div>
      </div>
    );
  };

  const isMobile = useIsMobile();
  const isTab = useIsTab();
  const [open, setOpen] = useState(false);

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

  const mobileFeatures = [
    "SCREEN_SHARE",
    "PARTICIPANTS",
    ...(isDoctor ? ["DOCUMENT_PANEL"] : []),
    "MEETING_ID_COPY",
  ];

  return isMobile || isTab ? (
    <div
      className="flex items-center justify-center bg-gray-750 border-t border-gray-600"
      style={{ height: bottomBarHeight }}
    >
      <LeaveBTN />
      <MicBTN />
      <WebCamBTN />
      {supportsOutputDevice && <OutputMicBTN />}
      <OutlinedButton Icon={EllipsisHorizontalIcon} onClick={() => setOpen(true)} />
      <Transition appear show={Boolean(open)} as={Fragment}>
        <Dialog as="div" className="relative" style={{ zIndex: 9999 }} onClose={() => setOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="translate-y-full opacity-0 scale-95" enterTo="translate-y-0 opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="translate-y-0 opacity-100 scale-100" leaveTo="translate-y-full opacity-0 scale-95">
            <div className="fixed inset-0 overflow-y-hidden">
              <div className="flex h-full items-end justify-end text-center">
                <Dialog.Panel className="w-screen transform overflow-hidden bg-gray-800 shadow-xl transition-all">
                  <div className="grid container bg-gray-800 py-6">
                    <div className="grid grid-cols-12 gap-2">
                      {mobileFeatures.map((icon, index) => (
                        <div
                          key={index}
                          className={`grid items-center justify-center ${icon === "MEETING_ID_COPY" ? "col-span-7 sm:col-span-5 md:col-span-3" : "col-span-4 sm:col-span-3 md:col-span-2"}`}
                        >
                          {icon === "SCREEN_SHARE" ? (
                            <ScreenShareBTN isMobile={isMobile} isTab={isTab} />
                          ) : icon === "PARTICIPANTS" ? (
                            <ParticipantsBTN isMobile={isMobile} isTab={isTab} />
                          ) : icon === "DOCUMENT_PANEL" ? (
                            <DocumentPanelBTN isMobile={isMobile} isTab={isTab} />
                          ) : icon === "MEETING_ID_COPY" ? (
                            <MeetingIdCopyBTN />
                          ) : null}
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
  ) : (
    <div
      className="md:flex lg:px-4 xl:px-8 px-3 hidden items-center bg-gray-750 border-t border-gray-600"
      style={{ height: bottomBarHeight }}
    >
      <MeetingIdCopyBTN />
      <div className="flex flex-1 items-center justify-center">
        <MicBTN />
        <WebCamBTN />
        {supportsOutputDevice && <OutputMicBTN />}
        <ScreenShareBTN isMobile={isMobile} isTab={isTab} />
        <LeaveBTN />
      </div>
      <div className="flex items-center justify-center">
        {isDoctor && <DocumentPanelBTN isMobile={isMobile} isTab={isTab} />}
        <ParticipantsBTN isMobile={isMobile} isTab={isTab} />
      </div>
    </div>
  );
}
