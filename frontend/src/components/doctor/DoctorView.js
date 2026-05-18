import { createCameraVideoTrack, useMeeting } from "@videosdk.live/react-sdk";
import { useState } from "react";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import { MemoizedParticipant } from "../ParticipantView";
import InfoTab from "./tabs/InfoTab";
import ActionsTab from "./tabs/ActionsTab";
import Tata1mgLogo from "../Tata1mgLogo";
import MicOnIcon from "../../icons/Bottombar/MicOnIcon";
import MicOffIcon from "../../icons/Bottombar/MicOffIcon";
import WebcamOnIcon from "../../icons/Bottombar/WebcamOnIcon";
import WebcamOffIcon from "../../icons/Bottombar/WebcamOffIcon";
import EndIcon from "../../icons/Bottombar/EndIcon";
import { VideoCameraIcon, ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { nameTructed, trimSnackBarText } from "../../utils/helper";

function VideoPanel() {
  const { participants, localParticipant } = useMeeting();
  const remoteIds = [...participants.keys()].filter(
    (id) => id !== localParticipant.id && participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  );
  const customerId = remoteIds[0] ?? null;

  return (
    <div className="relative w-full h-full bg-gray-800">
      <div className="absolute inset-0">
        {customerId ? (
          <MemoizedParticipant
            participantId={customerId}
            showImageCapture={false}
            showResolution={true}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
              <VideoCameraIcon className="w-8 h-8 text-gray-900" />
            </div>
            <p className="text-gray-900 text-sm">Waiting for customer to join…</p>
          </div>
        )}
      </div>
      {/* Doctor PiP */}
      <div className="absolute bottom-4 right-4 w-40 h-28 md:w-52 md:h-36 rounded-xl overflow-hidden border-2 border-gray-600 shadow-2xl z-10 bg-gray-700">
        <MemoizedParticipant
          participantId={localParticipant.id}
          showImageCapture={false}
          showResolution={false}
          isPip={true}
        />
      </div>
    </div>
  );
}

function CtrlBtn({ onClick, active, danger, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
        danger
          ? "bg-red-150 hover:bg-red-650 text-white"
          : active
          ? "bg-orange-450 hover:bg-orange-500 text-white"
          : "bg-gray-600 hover:bg-gray-500 text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function MeetingIdCopy() {
  const { meetingId } = useMeeting();
  const [copied, setCopied] = useState(false);
  if (!meetingId) return null;

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(meetingId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      title="Copy meeting ID"
      className="flex items-center gap-2 font-mono text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
    >
      <span>{meetingId}</span>
      {copied ? (
        <CheckIcon className="w-3.5 h-3.5 text-green-150 shrink-0" />
      ) : (
        <ClipboardIcon className="w-3.5 h-3.5 shrink-0" />
      )}
    </button>
  );
}

function DoctorControls() {
  const {
    localMicOn,
    localWebcamOn,
    toggleMic,
    enableWebcam,
    disableWebcam,
    leave,
    localParticipant,
  } = useMeeting();
  const { selectedWebcam } = useMeetingAppContext();

  async function handleWebcam() {
    if (localWebcamOn) {
      disableWebcam();
    } else {
      try {
        const track = await createCameraVideoTrack({
          cameraId: selectedWebcam?.id,
          optimizationMode: "motion",
          encoderConfig: "h480p_w640p",
          multiStream: false,
        });
        enableWebcam(track);
      } catch (err) {
        console.error("Webcam error:", err);
      }
    }
  }

  function handleLeave() {
    toast(
      `${trimSnackBarText(nameTructed(localParticipant.displayName, 15))} left the meeting.`,
      { position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, theme: "light" }
    );
    leave();
  }

  const sz = { width: 20, height: 20 };

  return (
    <div className="flex items-center gap-2">
      <CtrlBtn active={localMicOn} onClick={() => toggleMic()} title={localMicOn ? "Mute mic" : "Unmute mic"}>
        {localMicOn ? <MicOnIcon {...sz} fillcolor="white" /> : <MicOffIcon {...sz} fillcolor="#95959E" />}
      </CtrlBtn>

      <CtrlBtn active={localWebcamOn} onClick={handleWebcam} title={localWebcamOn ? "Turn off camera" : "Turn on camera"}>
        {localWebcamOn ? <WebcamOnIcon {...sz} fillcolor="white" /> : <WebcamOffIcon {...sz} fillcolor="#95959E" />}
      </CtrlBtn>

      <div className="w-px h-6 bg-gray-600 mx-1" />

      <CtrlBtn danger onClick={handleLeave} title="Leave meeting">
        <EndIcon {...sz} fillcolor="white" />
      </CtrlBtn>
    </div>
  );
}

export default function DoctorView() {
  const { caseId } = useMeetingAppContext();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 bg-gray-750 border-b border-gray-600 shrink-0 gap-4"
        style={{ height: 56 }}
      >
        <Tata1mgLogo />

        <div className="flex items-center gap-3 flex-1 justify-center">
          {caseId && (
            <div className="flex items-center gap-2">
              <span className="text-gray-900 text-xs">Case</span>
              <span className="font-mono text-xs font-semibold bg-gray-700 text-white px-3 py-1 rounded-lg">
                {caseId}
              </span>
            </div>
          )}
          <MeetingIdCopy />
        </div>

        <DoctorControls />
      </header>

      {/* Three-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: stepper / instructions — wider */}
        <aside className="w-96 xl:w-[440px] shrink-0 overflow-hidden border-r border-gray-300 bg-white flex flex-col">
          <ActionsTab />
        </aside>

        {/* CENTRE: live video */}
        <main className="flex-1 overflow-hidden">
          <VideoPanel />
        </main>

        {/* RIGHT: device + location info */}
        <aside className="w-80 xl:w-96 shrink-0 overflow-y-auto bg-slate-50 border-l border-gray-300">
          <InfoTab />
        </aside>
      </div>
    </div>
  );
}
