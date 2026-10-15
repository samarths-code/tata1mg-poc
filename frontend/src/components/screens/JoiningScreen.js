import React, { useEffect, useRef, useState } from "react";
import { MeetingDetailsScreen } from "../MeetingDetailsScreen";
import { getToken, validateMeeting } from "../../api";
import ConfirmBox from "../ConfirmBox";
import { toast } from "react-toastify";
import { Constants, useMediaDevice } from "@videosdk.live/react-sdk";
import usePrecallTest from "../../lib/usePrecallTest";
import DropDownCam from "../DropDownCam";
import DropDownSpeaker from "../DropDownSpeaker";
import DropDownMic from "../DropDownMic";
import { useMeetingAppContext } from "../../context/MeetingAppContext";
import useMediaStream from "../../hooks/useMediaStream";
import useIsMobile from "../../hooks/useIsMobile";
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
  customVideoStream,
  setCustomAudioStream,
  setCustomVideoStream,
  micOn,
  webcamOn,
  isAutoJoin,
  tokenReady,
  token,
  credentialError,
  meetingTitle,
  isAudioOnly = false,
  permissionsReady = false,
  inCall = false,
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
  // Once the call starts, the preview tracks belong to the meeting (published
  // as-is). This screen stays mounted behind the call, so it must never swap
  // or stop them afterwards — e.g. on a device-change event mid-call.
  const inCallRef = useRef(inCall);
  useEffect(() => { inCallRef.current = inCall; }, [inCall]);
  useEffect(() => { micRef.current = micOn; }, [micOn]);

  // Audio level analysis — runs in JoiningScreen so AudioContext is created
  // after a confirmed user gesture (mic toggle), avoiding browser autoplay blocks.
  useEffect(() => {
    clearInterval(audioAnalyserIntervalRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    // Stop metering once the call starts — this screen stays mounted (hidden)
    // behind the meeting and would otherwise re-render every 100 ms all call.
    if (!audioTrack || !micOn || inCall) { setMicVolume(0); return; }

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
  }, [audioTrack, micOn, inCall]);

  useEffect(() => {
    permissonAvaialble.current = {
      isCameraPermissionAllowed,
      isMicrophonePermissionAllowed,
    };
  }, [isCameraPermissionAllowed, isMicrophonePermissionAllowed]);

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
    // This screen stays mounted (hidden) behind the call. Decoding the camera
    // into a second, invisible <video> costs real CPU/GPU on a weak device —
    // detach once the call owns the track.
    if (inCall) {
      if (videoPlayerRef.current) videoPlayerRef.current.srcObject = null;
      return;
    }
    if (webcamOn) {
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
  }, [webcamOn, videoTrack, inCall]);

  useEffect(() => { if (!isAudioOnly) getCameraDevices(); }, [isCameraPermissionAllowed]);
  useEffect(() => { getAudioDevices(); }, [isMicrophonePermissionAllowed]);

  useEffect(() => {
    if (permissionsReady) checkMediaPermission();
    return () => {};
  }, [permissionsReady]);

  // The preview track IS the track published on join (passed to MeetingProvider
  // as a custom track), so what the user sees here is exactly what's sent.
  // Every swap stops the previous track so pre-call never holds two cameras/mics.
  const replaceVideo = (stream) => {
    // A track that resolved after Join was clicked is not the published one — drop it.
    if (inCallRef.current) { stream?.getTracks().forEach((t) => t.stop()); return; }
    const next = stream?.getVideoTracks()[0] ?? null;
    const prev = videoTrackRef.current;
    if (prev && prev !== next) prev.stop();
    videoTrackRef.current = next;
    setCustomVideoStream(stream || null);
    setVideoTrack(next);
  };

  const replaceAudio = (stream) => {
    if (inCallRef.current) { stream?.getTracks().forEach((t) => t.stop()); return; }
    const next = stream?.getAudioTracks()[0] ?? null;
    const prev = audioTrackRef.current;
    if (prev && prev !== next) prev.stop();
    audioTrackRef.current = next;
    setCustomAudioStream(stream || null);
    setAudioTrack(next);
  };

  const _toggleWebcam = () => {
    if (webcamOn) {
      replaceVideo(null);
      setWebcamOn(false);
    } else {
      getDefaultMediaTracks({ mic: false, webcam: true });
      setWebcamOn(true);
    }
  };

  const _toggleMic = () => {
    if (micOn) {
      replaceAudio(null);
      setMicOn(false);
      setSpekerOn(false);
    } else {
      getDefaultMediaTracks({ mic: true, webcam: false });
      setMicOn(true);
      setSpekerOn(true);
    }
  };

  const changeWebcam = async (deviceId) => {
    if (webcamRef.current) replaceVideo(await getVideoTrack({ webcamId: deviceId }));
  };

  const changeMic = async (deviceId) => {
    if (micRef.current) replaceAudio(await getAudioTrack({ micId: deviceId }));
  };

  const getDefaultMediaTracks = async ({ mic, webcam }) => {
    if (mic) replaceAudio(await getAudioTrack({ micId: selectedMicrophone?.id }));
    if (webcam && !isAudioOnly) replaceVideo(await getVideoTrack({ webcamId: selectedWebcam?.id }));
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
    if (inCallRef.current) return; // in-call device changes are the meeting's job
    setDidDeviceChange(true);
    if (!isAudioOnly) getCameraDevices();
    getAudioDevices();
    getDefaultMediaTracks({ mic: micRef.current, webcam: webcamRef.current && !isAudioOnly });
  }

  const checkMediaPermission = async () => {
    // Audio-only calls never check, request or open the camera.
    const result = await checkPermissions(isAudioOnly ? Constants.permission.AUDIO : undefined);
    const micAllowed = result.get(Constants.permission.AUDIO);
    setIsMicrophonePermissionAllowed(micAllowed);
    if (micAllowed) { setMicOn(true); getDefaultMediaTracks({ mic: true, webcam: false }); }
    else { await requestAudioVideoPermission(Constants.permission.AUDIO); }
    if (isAudioOnly) return;
    const camAllowed = result.get(Constants.permission.VIDEO);
    setIsCameraPermissionAllowed(camAllowed);
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

  // Pre-call network test runs on the exact tracks being previewed (and later
  // published). Restarts when they change; stops once the call starts.
  const precall = usePrecallTest({
    token,
    audioStream: micOn ? customAudioStream : null,
    videoStream: isAudioOnly || !webcamOn ? null : customVideoStream,
    enabled: !inCall,
  });

  // Join: stop the test if it's still sampling (12 s), take its result, and
  // pass the result's tracks — the same MediaStreams it tested — to MeetingProvider.
  const joiningRef = useRef(false);
  const startMeeting = async () => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    try {
      const raw = await precall.finish();
      const isLive = (st) => !!st && st.getTracks().length > 0 && st.getTracks().every((t) => t.readyState === "live");
      const mic = raw?.microphone?.track;
      const cam = raw?.camera?.track;
      if (micRef.current && isLive(mic)) setCustomAudioStream(mic);
      if (!isAudioOnly && webcamRef.current && isLive(cam)) setCustomVideoStream(cam);
      await onClickStartMeeting();
    } finally {
      joiningRef.current = false;
    }
  };

  // ── Render helpers (plain functions, NOT components) ─────────────────────────
  // Defined as functions called with {renderCameraCard(...)} not <CameraCard/>.
  // Defining them as components inside a render body would give React a new type
  // on every render → unmount+remount → the pre-call test would re-run.
  const renderCameraCard = (height, width, rounded = "rounded-[24px]") => (
    <div
      className={`relative bg-[#303033] ${rounded} overflow-hidden shrink-0 w-full`}
      style={{ height, width }}
    >
      <audio playsInline muted ref={audioPlayerRef} controls={false} />
      {isAudioOnly ? (
        <AudioOnlyPreview name={participantName} micOn={micOn} volume={micVolume} />
      ) : (
      <video
        autoPlay playsInline muted ref={videoPlayerRef} controls={false}
        className="h-full w-full object-cover flip"
        style={{ backgroundColor: "#303033" }}
      />
      )}
      {!webcamOn && !isAudioOnly && (
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
        {!isAudioOnly && <div className="relative">
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
        </div>}

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
    <div className={stacked ? "flex flex-col gap-2" : `grid ${isAudioOnly ? "grid-cols-2" : "grid-cols-3"} gap-2`}>
      <DropDownMic mics={mics} changeMic={changeMic} customAudioStream={customAudioStream}
        micOn={micOn} volume={micVolume} didDeviceChange={didDeviceChange}
        setDidDeviceChange={setDidDeviceChange} testSpeaker={testSpeaker} setTestSpeaker={setTestSpeaker} />
      <DropDownSpeaker speakers={speakers} />
      {!isAudioOnly && <DropDownCam changeWebcam={changeWebcam} webcams={webcams} />}
    </div>
  );

  return (
    <>

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
                    Your doctor is ready to meet you
                  </p>
                  <h1 className="text-black text-xl font-medium leading-7 px-2">
                    {meetingTitle || "Online Application"}
                  </h1>
                  {isAudioOnly && (
                    <p className="text-[#5e5e61] text-sm font-medium leading-5">Audio-only call</p>
                  )}
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
                  onClick={startMeeting}
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
                onClickStartMeeting={startMeeting}
                onClickJoin={async (id) => {
                  if (tokenReady) { setMeetingId(id); startMeeting(); return; }
                  const valid = await validateMeeting({ roomId: id });
                  if (valid) {
                    const token = await getToken({ roomId: id });
                    setToken(token); setMeetingId(id); startMeeting();
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
                    onClickStartMeeting={startMeeting}
                    meetingTitle={meetingTitle}
                    isAudioOnly={isAudioOnly}
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
                      onClickStartMeeting={startMeeting}
                      onClickJoin={async (id) => {
                        if (tokenReady) { setMeetingId(id); startMeeting(); return; }
                        const valid = await validateMeeting({ roomId: id });
                        if (valid) {
                          const token = await getToken({ roomId: id });
                          setToken(token); setMeetingId(id); startMeeting();
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
  isAudioOnly,
}) {
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
        {isAudioOnly && !credentialError && (
          <p className="text-[#5e5e61] text-sm font-medium leading-5">Audio-only call</p>
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

// Stand-in for the camera preview in audio-only calls: initial + live mic ring.
function AudioOnlyPreview({ name, micOn, volume }) {
  const ring = micOn ? Math.min(24, Math.round(volume / 3)) : 0;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <div
        className="w-20 h-20 rounded-full bg-[#1b1b1e] flex items-center justify-center transition-shadow duration-100"
        style={{ boxShadow: `0 0 0 ${ring}px rgba(255,111,97,0.35)` }}
      >
        <span className="text-white text-3xl font-medium">
          {(name || "?").charAt(0).toUpperCase()}
        </span>
      </div>
      <p className="text-white/80 text-sm">Audio-only call</p>
    </div>
  );
}
