import React, { useEffect, useRef, useState } from "react";
import { MeetingDetailsScreen } from "../MeetingDetailsScreen";
import { getToken, validateMeeting } from "../../api";
import ConfirmBox from "../ConfirmBox";
import WebcamOffIcon from "../../icons/WebcamOffIcon";
import WebcamOnIcon from "../../icons/Bottombar/WebcamOnIcon";
import MicOffIcon from "../../icons/MicOffIcon";
import MicOnIcon from "../../icons/Bottombar/MicOnIcon";
import { toast } from "react-toastify";
import { Constants, useMediaDevice } from "@videosdk.live/react-sdk";
import MicPermissionDenied from "../../icons/MicPermissionDenied";
import CameraPermissionDenied from "../../icons/CameraPermissionDenied";
import NetworkStats from "../NetworkStats";
import DropDownCam from "../DropDownCam";
import DropDownSpeaker from "../DropDownSpeaker";
import DropDownMic from "../DropDownMic";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import useMediaStream from "../../hooks/useMediaStream";
import useIsMobile from "../../hooks/useIsMobile";
import PermissionSetup from "../PermissionSetup";
import { participantModes } from "../../utils/common";
import DeviceEnableModal from "../DeviceEnableModal";
import { ShieldCheckIcon, ChevronRightIcon, MicrophoneIcon, VideoCameraIcon, VideoCameraSlashIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";

export function JoiningScreen({
  setSpekerOn,
  participantName,
  setParticipantName,
  setMeetingId,
  setToken,
  setMicOn,
  setWebcamOn,
  onClickStartMeeting,
  customAudioStream,
  setCustomAudioStream,
  setCustomVideoStream,
  micOn,
  webcamOn,
  isAutoJoin,
  tokenReady,
  token,
  credentialError,
  meetingTitle,
}) {
  const {
    selectedWebcam,
    selectedMicrophone,
    setSelectedMicroPhone,
    setSelectedWebcam,
    setSelectedSpeaker,
    isCameraPermissionAllowed,
    isMicrophonePermissionAllowed,
    setIsCameraPermissionAllowed,
    setIsMicrophonePermissionAllowed,
    participantMode,
  } = useMeetingAppContext();

  const [permissionDone, setPermissionDone] = useState(false);
  const isMobile = useIsMobile();

  const [{ webcams, mics, speakers }, setDevices] = useState({
    webcams: [],
    mics: [],
    speakers: [],
  });
  const { getVideoTrack, getAudioTrack } = useMediaStream();
  const {
    checkPermissions,
    getCameras,
    getMicrophones,
    requestPermission,
    getPlaybackDevices,
  } = useMediaDevice({ onDeviceChanged });

  const [audioTrack, setAudioTrack] = useState(null);
  const [videoTrack, setVideoTrack] = useState(null);
  const [dlgDevices, setDlgDevices] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(null); // null | 'mic' | 'camera' | 'speaker'
  const [didDeviceChange, setDidDeviceChange] = useState(false);
  const [testSpeaker, setTestSpeaker] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const videoPlayerRef = useRef();
  const audioPlayerRef = useRef();
  const videoTrackRef = useRef();
  const audioTrackRef = useRef();
  const audioAnalyserIntervalRef = useRef();
  const audioCtxRef = useRef(null);
  const permissonAvaialble = useRef();
  const webcamRef = useRef();
  const micRef = useRef();

  useEffect(() => { webcamRef.current = webcamOn; }, [webcamOn]);
  useEffect(() => { micRef.current = micOn; }, [micOn]);

  // Audio level analysis — runs in JoiningScreen so AudioContext is created
  // after a confirmed user gesture (mic toggle), avoiding browser autoplay blocks.
  useEffect(() => {
    clearInterval(audioAnalyserIntervalRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    if (!audioTrack || !micOn) { setMicVolume(0); return; }

    let cancelled = false;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    ctx.resume().then(() => {
      if (cancelled) return;
      const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      src.connect(analyser);
      // Explicitly terminate the audio graph at a silent sink.
      // Without this, Chrome implicitly routes MediaStreamSource audio to speakers.
      analyser.connect(ctx.createMediaStreamDestination());
      const buf = new Uint8Array(analyser.frequencyBinCount);
      audioAnalyserIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(buf);
        setMicVolume(buf.reduce((s, v) => s + v, 0) / buf.length);
      }, 100);
    });

    return () => {
      cancelled = true;
      clearInterval(audioAnalyserIntervalRef.current);
      ctx.close();
      audioCtxRef.current = null;
    };
  }, [audioTrack, micOn]);

  useEffect(() => {
    permissonAvaialble.current = {
      isCameraPermissionAllowed,
      isMicrophonePermissionAllowed,
    };
  }, [isCameraPermissionAllowed, isMicrophonePermissionAllowed]);

  useEffect(() => {
    if (micOn) { audioTrackRef.current = audioTrack; }
  }, [micOn, audioTrack]);

  useEffect(() => {
    if (micOn) {
      if (audioTrackRef.current && audioTrackRef.current !== audioTrack) {
        audioTrackRef.current.stop();
      }
      audioTrackRef.current = audioTrack;
    }
  }, [micOn, audioTrack]);

  // Only route the mic to the speaker element when testSpeaker is explicitly on.
  // Never set srcObject otherwise — muted is unreliable and the echo is unavoidable.
  useEffect(() => {
    const player = audioPlayerRef.current;
    if (!player) return;
    if (testSpeaker && micOn && audioTrack) {
      player.muted = false;
      player.srcObject = new MediaStream([audioTrack]);
      player.play().catch((e) => console.log("audio play error", e));
    } else {
      player.pause();
      player.srcObject = null;
    }
  }, [testSpeaker, micOn, audioTrack]);

  useEffect(() => {
    if (webcamOn) {
      videoTrackRef.current = videoTrack;
      const isPlaying =
        videoPlayerRef.current.currentTime > 0 &&
        !videoPlayerRef.current.paused &&
        !videoPlayerRef.current.ended &&
        videoPlayerRef.current.readyState > videoPlayerRef.current.HAVE_CURRENT_DATA;
      if (videoTrack) {
        const videoSrcObject = new MediaStream([videoTrack]);
        if (videoPlayerRef.current) {
          videoPlayerRef.current.srcObject = videoSrcObject;
          if (videoPlayerRef.current.pause && !isPlaying) {
            videoPlayerRef.current.play().catch((e) => console.log("error", e));
          }
        }
      } else {
        if (videoPlayerRef.current) videoPlayerRef.current.srcObject = null;
      }
    }
  }, [webcamOn, videoTrack]);

  useEffect(() => { getCameraDevices(); }, [isCameraPermissionAllowed]);
  useEffect(() => { getAudioDevices(); }, [isMicrophonePermissionAllowed]);

  useEffect(() => {
    if (permissionDone) checkMediaPermission();
    return () => {};
  }, [permissionDone]);

  const _toggleWebcam = () => {
    const track = videoTrackRef.current;
    if (webcamOn) {
      if (track) { track.stop(); setVideoTrack(null); setCustomVideoStream(null); setWebcamOn(false); }
    } else {
      getDefaultMediaTracks({ mic: false, webcam: true });
      setWebcamOn(true);
    }
  };

  const _toggleMic = () => {
    const track = audioTrackRef.current;
    if (micOn) {
      if (track) { track.stop(); setAudioTrack(null); setCustomAudioStream(null); setMicOn(false); setSpekerOn(false); }
    } else {
      getDefaultMediaTracks({ mic: true, webcam: false });
      setMicOn(true);
      setSpekerOn(true);
    }
  };

  const changeWebcam = async (deviceId) => {
    if (webcamOn) {
      const cur = videoTrackRef.current;
      if (cur) cur.stop();
      const stream = await getVideoTrack({ webcamId: deviceId });
      setCustomVideoStream(stream);
      const tracks = stream?.getVideoTracks();
      setVideoTrack(tracks?.length ? tracks[0] : null);
    }
  };

  const changeMic = async (deviceId) => {
    if (micOn) {
      const cur = audioTrackRef.current;
      cur && cur.stop();
      const stream = await getAudioTrack({ micId: deviceId });
      setCustomAudioStream(stream);
      const tracks = stream?.getAudioTracks();
      clearInterval(audioAnalyserIntervalRef.current);
      setAudioTrack(tracks?.length ? tracks[0] : null);
    }
  };

  const getDefaultMediaTracks = async ({ mic, webcam }) => {
    if (mic) {
      const stream = await getAudioTrack({ micId: selectedMicrophone?.id });
      setCustomAudioStream(stream);
      const tracks = stream?.getAudioTracks();
      setAudioTrack(tracks?.length ? tracks[0] : null);
    }
    if (webcam) {
      const stream = await getVideoTrack({ webcamId: selectedWebcam?.id });
      setCustomVideoStream(stream);
      const tracks = stream?.getVideoTracks();
      setVideoTrack(tracks?.length ? tracks[0] : null);
    }
  };

  async function requestAudioVideoPermission(mediaType) {
    try {
      const permission = await requestPermission(mediaType);
      if (mediaType === Constants.permission.AUDIO) {
        setIsMicrophonePermissionAllowed(permission.get(Constants.permission.AUDIO));
      }
      if (mediaType === Constants.permission.VIDEO) {
        setIsCameraPermissionAllowed(permission.get(Constants.permission.VIDEO));
      }
      if (permission.get(Constants.permission.AUDIO)) {
        setMicOn(true);
        getDefaultMediaTracks({ mic: true, webcam: false });
      }
      if (permission.get(Constants.permission.VIDEO)) {
        setWebcamOn(true);
        getDefaultMediaTracks({ mic: false, webcam: true });
      }
    } catch (ex) {
      console.log("Error in requestPermission", ex);
    }
  }

  function onDeviceChanged() {
    setDidDeviceChange(true);
    getCameraDevices();
    getAudioDevices();
    getDefaultMediaTracks({ mic: micRef.current, webcam: webcamRef.current });
  }

  const checkMediaPermission = async () => {
    const result = await checkPermissions();
    const camAllowed = result.get(Constants.permission.VIDEO);
    const micAllowed = result.get(Constants.permission.AUDIO);
    setIsCameraPermissionAllowed(camAllowed);
    setIsMicrophonePermissionAllowed(micAllowed);
    if (micAllowed) { setMicOn(true); getDefaultMediaTracks({ mic: true, webcam: false }); }
    else { await requestAudioVideoPermission(Constants.permission.AUDIO); }
    if (camAllowed) { setWebcamOn(true); getDefaultMediaTracks({ mic: false, webcam: true }); }
    else { await requestAudioVideoPermission(Constants.permission.VIDEO); }
  };

  const getCameraDevices = async () => {
    try {
      if (permissonAvaialble.current?.isCameraPermissionAllowed) {
        let cams = await getCameras();
        setSelectedWebcam({ id: cams[0]?.deviceId, label: cams[0]?.label });
        setDevices((d) => ({ ...d, webcams: cams }));
      }
    } catch (err) {
      console.log("Error getting camera devices", err);
    }
  };

  const getAudioDevices = async () => {
    try {
      if (permissonAvaialble.current?.isMicrophonePermissionAllowed) {
        const [micList, spkrList] = await Promise.all([getMicrophones(), getPlaybackDevices()]);
        if (micList?.length) {
          setSelectedMicroPhone({ id: micList[0]?.deviceId, label: micList[0]?.label });
        }
        if (spkrList?.length) {
          setSelectedSpeaker({ id: spkrList[0]?.deviceId, label: spkrList[0]?.label });
        }
        setDevices((d) => ({ ...d, mics: micList ?? [], speakers: spkrList ?? [] }));
      }
    } catch (err) {
      console.log("Error getting audio devices", err);
    }
  };

  // ── Render helpers (plain functions, NOT components) ─────────────────────────
  // Defined as functions called with {renderCameraCard(...)} not <CameraCard/>.
  // Defining them as components inside a render body would give React a new type
  // on every render → unmount+remount → NetworkStats re-runs the pre-call test again.
  const renderCameraCard = (height, width, rounded = "rounded-[24px]") => (
    <div
      className={`relative bg-[#303033] ${rounded} overflow-hidden shrink-0 w-full`}
      style={{ height, width }}
    >
      <div className="absolute right-4 top-4 z-10"><NetworkStats token={token} /></div>
      <audio playsInline muted ref={audioPlayerRef} controls={false} />
      <video
        autoPlay playsInline muted ref={videoPlayerRef} controls={false}
        className="h-full w-full object-cover flip"
        style={{ backgroundColor: "#303033" }}
      />
      {!webcamOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white text-2xl font-normal">Camera is off</p>
        </div>
      )}
      <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        {/* Mic button */}
        <div className="relative">
          <button
            onClick={() => isMicrophonePermissionAllowed ? _toggleMic() : setShowDeviceModal('mic')}
            className="bg-[rgba(0,0,0,0.5)] border border-white/80 rounded flex items-center justify-center h-8 w-8"
          >
            <MicrophoneIcon className={`w-5 h-5 ${micOn && isMicrophonePermissionAllowed ? "text-white" : "text-white"}`} />
          </button>
          {!isMicrophonePermissionAllowed && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#dc2626] flex items-center justify-center text-white text-[7px] font-bold leading-none">!</span>
          )}
        </div>

        {/* Camera button */}
        <div className="relative">
          <button
            onClick={() => isCameraPermissionAllowed ? _toggleWebcam() : setShowDeviceModal('camera')}
            className="bg-[rgba(0,0,0,0.5)] border border-white/80 rounded flex items-center justify-center h-8 w-8"
          >
            {webcamOn && isCameraPermissionAllowed
              ? <VideoCameraIcon className="w-5 h-5 text-white" />
              : <VideoCameraSlashIcon className="w-5 h-5 text-white" />}
          </button>
          {!isCameraPermissionAllowed && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#dc2626] flex items-center justify-center text-white text-[7px] font-bold leading-none">!</span>
          )}
        </div>

        {/* Speaker button */}
        <div className="relative">
          <button
            onClick={() => testSpeaker ? setTestSpeaker(false) : setShowDeviceModal('speaker')}
            className="bg-[rgba(0,0,0,0.5)] border border-white/80 rounded flex items-center justify-center h-8 w-8"
          >
            {testSpeaker
              ? <SpeakerWaveIcon className="w-5 h-5 text-white" />
              : <SpeakerXMarkIcon className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderDeviceSelectors = (stacked) => (
    <div className={stacked ? "flex flex-col gap-2" : "grid grid-cols-3 gap-2"}>
      <DropDownMic mics={mics} changeMic={changeMic} customAudioStream={customAudioStream}
        micOn={micOn} volume={micVolume} didDeviceChange={didDeviceChange}
        setDidDeviceChange={setDidDeviceChange} testSpeaker={testSpeaker} setTestSpeaker={setTestSpeaker} />
      <DropDownSpeaker speakers={speakers} />
      <DropDownCam changeWebcam={changeWebcam} webcams={webcams} />
    </div>
  );

  return (
    <>
      {!permissionDone && <PermissionSetup onDone={() => setPermissionDone(true)} />}

      {/* ── Internet disconnect popup ───────────────────────────────────────── */}
      {isOffline && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[320px] flex flex-col items-center gap-4 px-6 py-8">
            {/* Icon */}
            <div className="w-14 h-14 rounded-full bg-[#fff1f0] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#dc2626]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
            </div>
            {/* Text */}
            <div className="flex flex-col gap-1 items-center text-center">
              <h3 className="text-black text-base font-semibold leading-6">No Internet Connection</h3>
              <p className="text-[#5e5e61] text-sm leading-5">
                Please check your connection to continue.
              </p>
            </div>
            {/* Retry button */}
            <button
              onClick={() => setIsOffline(!navigator.onLine)}
              className="w-full bg-[#ff6f61] text-white text-sm font-semibold py-2.5 rounded-xl"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <div className="bg-white min-h-screen relative overflow-x-hidden">

        {isMobile ? (
          /* ── MOBILE LAYOUT ─────────────────────────────────────────────────────
             Order matches Figma 437-23578: header → camera → selectors → button  */
          <div className="flex flex-col px-4 pt-[62px] pb-10 gap-3">

            {/* 1. Header info */}
            <div className="flex flex-col gap-1 items-center text-center">
              {isAutoJoin ? (
                <>
                  <p className="text-[#5e5e61] text-sm font-medium leading-5">
                    Your agent is ready to meet you
                  </p>
                  <h1 className="text-black text-xl font-medium leading-7 px-2">
                    {meetingTitle || "Online Application"}
                  </h1>
                  <p className="text-[#5e5e61] text-sm font-medium leading-5">
                    Please keep a valid photo ID ready for verification.
                  </p>
                </>
              ) : (
                <h2 className="text-black text-xl font-semibold">Ready to join?</h2>
              )}
            </div>

            {/* 2. Camera preview */}
            <div style={{ aspectRatio: "370 / 300" }}>
              {renderCameraCard("100%", "100%")}
            </div>

            {/* 3. Device selectors — stacked full-width */}
            {renderDeviceSelectors(true)}

            {/* 4. Name input + join (auto-join flow) */}
            {isAutoJoin ? (
              <>
                {credentialError ? (
                  <p className="text-sm text-[#dc2626] bg-[#fee2e2] border border-[#fca5a5] rounded-xl px-4 py-3 text-center">
                    {credentialError}
                  </p>
                ) : (
                  <>
                    {!tokenReady && (
                      <p className="text-xs text-[#919093] text-center">Setting up your session…</p>
                    )}
                  </>
                )}
                <button
                  disabled={!(participantName.length >= 3 && tokenReady && !credentialError)}
                  onClick={onClickStartMeeting}
                  className="flex items-center justify-center gap-1 w-full px-4 py-3 rounded bg-[#ff6f61] text-white text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tokenReady ? "Start Application" : "Setting up…"}
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </>
            ) : (
              <MeetingDetailsScreen
                participantName={participantName}
                setParticipantName={setParticipantName}
                onClickStartMeeting={onClickStartMeeting}
                onClickJoin={async (id) => {
                  if (tokenReady) { setMeetingId(id); onClickStartMeeting(); return; }
                  const valid = await validateMeeting({ roomId: id });
                  if (valid) {
                    const token = await getToken({ roomId: id });
                    setToken(token); setMeetingId(id); onClickStartMeeting();
                  } else {
                    toast("Invalid Meeting ID", { position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, theme: "dark" });
                  }
                }}
              />
            )}

            {/* 5. Security note */}
            <p className="text-[#5e5e61] text-xs font-medium text-center px-2 leading-4">
              Your meeting is secure and encrypted. No one can join unless they are invited.
            </p>
          </div>

        ) : (
          /* ── DESKTOP LAYOUT ─────────────────────────────────────────────────── */
          <>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                            flex flex-row items-center justify-between gap-8
                            w-full max-w-[1126px] px-4">

              {/* LEFT — camera + device selectors */}
              <div className="flex flex-col gap-3">
                {renderCameraCard(375, 647, "rounded-3xl")}
                <div style={{ width: 647 }}>
                  {renderDeviceSelectors(false)}
                </div>
              </div>

              {/* RIGHT — meeting info / join form */}
              <div className="flex flex-col items-center justify-center gap-8 flex-1 px-6 py-5 self-stretch">
                {isAutoJoin ? (
                  <AutoJoinPanel
                    participantName={participantName}
                    setParticipantName={setParticipantName}
                    participantMode={participantMode}
                    tokenReady={tokenReady}
                    credentialError={credentialError}
                    onClickStartMeeting={onClickStartMeeting}
                    meetingTitle={meetingTitle}
                  />
                ) : (
                  <div className="w-full max-w-sm">
                    <div className="mb-5 text-center">
                      <h2 className="text-xl font-semibold text-black">Ready to join?</h2>
                      <p className="text-[#919093] text-sm mt-1">Enter your details to join the Application</p>
                    </div>
                    <MeetingDetailsScreen
                      participantName={participantName}
                      setParticipantName={setParticipantName}
                      onClickStartMeeting={onClickStartMeeting}
                      onClickJoin={async (id) => {
                        if (tokenReady) { setMeetingId(id); onClickStartMeeting(); return; }
                        const valid = await validateMeeting({ roomId: id });
                        if (valid) {
                          const token = await getToken({ roomId: id });
                          setToken(token); setMeetingId(id); onClickStartMeeting();
                        } else {
                          toast("Invalid Meeting ID", { position: "bottom-left", autoClose: 4000, hideProgressBar: true, closeButton: false, theme: "dark" });
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Desktop security footer */}
            <div className="absolute bottom-[22px] left-1/2 -translate-x-1/2 whitespace-nowrap
                            flex items-center gap-2.5 text-[#5e5e61] text-sm font-medium">
              <ShieldCheckIcon className="w-4 h-4 shrink-0" />
              <p>Your meeting is secure and encrypted. No one can join unless they are invited.</p>
            </div>
          </>
        )}
      </div>

      <ConfirmBox
        open={dlgDevices}
        successText="DISMISS"
        onSuccess={() => setDlgDevices(false)}
        title="Mic or webcam not available"
        subTitle="Please connect a mic and webcam to speak and share your video in the meeting. You can also join without them."
      />

      {/* Device enable modal — shown when clicking a blocked device button */}
      <DeviceEnableModal
        device={showDeviceModal}
        onClose={() => setShowDeviceModal(null)}
        onEnable={() => {
          if (showDeviceModal === 'mic') {
            requestAudioVideoPermission(Constants.permission.AUDIO);
          } else if (showDeviceModal === 'camera') {
            requestAudioVideoPermission(Constants.permission.VIDEO);
          } else if (showDeviceModal === 'speaker') {
            setTestSpeaker(true);
            setSpekerOn(true);
          }
        }}
      />
    </>
  );
}

function AutoJoinPanel({
  participantName,
  setParticipantName,
  participantMode,
  tokenReady,
  credentialError,
  onClickStartMeeting,
  meetingTitle,
}) {
  const roleLabel = participantMode === participantModes.DOCTOR ? "Agent" : "Client";
  const canJoin = participantName.length >= 3 && tokenReady && !credentialError;

  return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      {/* Meeting info */}
      <div className="flex flex-col gap-2 items-center">
        <p className="text-[#5e5e61] text-sm font-medium leading-5">
          Join your Application instantly
        </p>
        {credentialError ? (
          <p className="text-sm text-[#dc2626] bg-[#fee2e2] border border-[#fca5a5] rounded-xl px-4 py-3 mt-1">
            {credentialError}
          </p>
        ) : (
          <h2 className="text-black text-2xl font-medium leading-8">
            {meetingTitle}
          </h2>
        )}
      </div>

      {/* Name + Join */}
      {!credentialError && (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          {!tokenReady && (
            <p className="text-xs text-[#919093]">Setting up your session…</p>
          )}
          <button
            disabled={!canJoin}
            onClick={onClickStartMeeting}
            className={`flex items-center gap-1 px-4 py-2 rounded text-base font-medium text-white transition-colors ${
              canJoin
                ? "bg-orange-450 hover:bg-orange-500 active:scale-95"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {tokenReady ? "Join Meeting" : "Setting up…"}
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
