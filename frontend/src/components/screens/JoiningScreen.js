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
import Tata1mgLogo from "../Tata1mgLogo";
import { ShieldCheckIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

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
  const [didDeviceChange, setDidDeviceChange] = useState(false);
  const [testSpeaker, setTestSpeaker] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

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
      if (audioTrack) {
        const audioSrcObject = new MediaStream([audioTrack]);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.srcObject = audioSrcObject;
          audioPlayerRef.current.play().catch((e) => console.log("audio play error", e));
        }
      } else {
        if (audioPlayerRef.current) audioPlayerRef.current.srcObject = null;
      }
    }
  }, [micOn, audioTrack]);

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

  // Video height: fixed on desktop, proportional on mobile
  const videoHeight = isMobile ? "56vw" : 375;
  const videoWidth = isMobile ? "100%" : 647;

  return (
    <>
      {!permissionDone && (
        <PermissionSetup onDone={() => setPermissionDone(true)} />
      )}

      <div className="bg-white min-h-screen relative overflow-x-hidden">

        {/* Logo — top-left */}
        <div className="absolute left-[30px] top-[30px] z-10">
          <Tata1mgLogo dark />
        </div>

        {/* Main content — centered vertically and horizontally */}
        <div className={`flex flex-col gap-4 w-full max-w-[1126px] mx-auto px-4 ${
          isMobile ? "pt-24 pb-16" : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        }`}>

          {/* Top row: video + right panel */}
          <div className={`flex ${isMobile ? "flex-col gap-6" : "flex-row items-center justify-between"}`}>

            {/* LEFT — video preview + device bar */}
            <div className="flex flex-col gap-3">
              {/* Video card */}
              <div
                className="relative bg-gray-900 rounded-3xl overflow-hidden shrink-0"
                style={{ width: videoWidth, height: videoHeight, minHeight: 180 }}
              >
                {/* Network stats badge */}
                <div className="absolute right-5 top-5 z-10">
                  <NetworkStats />
                </div>

                {/* Audio (hidden) */}
                <audio autoPlay playsInline muted={!testSpeaker} ref={audioPlayerRef} controls={false} />

                {/* Camera feed */}
                <video
                  autoPlay playsInline muted ref={videoPlayerRef} controls={false}
                  style={{ backgroundColor: "#111827" }}
                  className="h-full w-full object-cover flip"
                />

                {/* Bottom media control pills */}
                <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 flex items-center gap-2.5">
                  {/* Mic */}
                  {isMicrophonePermissionAllowed ? (
                    <button
                      onClick={_toggleMic}
                      className="bg-[rgba(0,0,0,0.5)] border border-white/80 rounded flex items-center gap-1 h-8 pl-1 pr-2 py-1"
                    >
                      <div className="flex items-center justify-center p-1.5 rounded-lg">
                        {micOn
                          ? <MicOnIcon fillcolor="white" style={{ width: 20, height: 20 }} />
                          : <MicOffIcon fillcolor="white" style={{ width: 20, height: 20 }} />
                        }
                      </div>
                    </button>
                  ) : (
                    <MicPermissionDenied />
                  )}

                  {/* Webcam */}
                  {isCameraPermissionAllowed ? (
                    <button
                      onClick={_toggleWebcam}
                      className="bg-[rgba(0,0,0,0.5)] border border-white/80 rounded flex items-center h-8 p-1"
                    >
                      <div className="flex items-center justify-center p-1.5 rounded-lg">
                        {webcamOn
                          ? <WebcamOnIcon fillcolor="white" style={{ width: 20, height: 20 }} />
                          : <WebcamOffIcon fillcolor="white" style={{ width: 20, height: 20 }} />
                        }
                      </div>
                    </button>
                  ) : (
                    <CameraPermissionDenied />
                  )}

                  {/* Speaker (test toggle on mobile) */}
                  <button
                    onClick={() => setTestSpeaker((s) => !s)}
                    className="bg-[rgba(0,0,0,0.5)] border border-white/80 rounded flex items-center h-8 p-1"
                  >
                    <div className="flex items-center justify-center p-1.5 rounded-lg">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>

              {/* Device selector row */}
              <div className={`flex gap-3 ${isMobile ? "flex-col" : "flex-row"}`} style={{ width: videoWidth }}>
                <div className={isMobile ? "w-full" : "flex-1 min-w-0"}>
                  <DropDownMic
                    mics={mics}
                    changeMic={changeMic}
                    customAudioStream={customAudioStream}
                    micOn={micOn}
                    volume={micVolume}
                    didDeviceChange={didDeviceChange}
                    setDidDeviceChange={setDidDeviceChange}
                    testSpeaker={testSpeaker}
                    setTestSpeaker={setTestSpeaker}
                  />
                </div>
                {!isMobile && (
                  <div className="flex-1 min-w-0">
                    <DropDownSpeaker speakers={speakers} />
                  </div>
                )}
                <div className={isMobile ? "w-full" : "flex-1 min-w-0"}>
                  <DropDownCam changeWebcam={changeWebcam} webcams={webcams} />
                </div>
              </div>
            </div>

            {/* RIGHT — meeting info / join form */}
            <div className={`flex flex-col items-center justify-center gap-8 ${isMobile ? "w-full" : "flex-1 px-6 py-5 self-stretch"}`}>
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
                    <p className="text-[#919093] text-sm mt-1">Enter your details to join the consultation</p>
                  </div>
                  <MeetingDetailsScreen
                    participantName={participantName}
                    setParticipantName={setParticipantName}
                    onClickStartMeeting={onClickStartMeeting}
                    onClickJoin={async (id) => {
                      // Token already provided (e.g. via URL) — join directly, no backend call.
                      if (tokenReady) {
                        setMeetingId(id);
                        onClickStartMeeting();
                        return;
                      }
                      const valid = await validateMeeting({ roomId: id });
                      if (valid) {
                        const token = await getToken({ roomId: id });
                        setToken(token);
                        setMeetingId(id);
                        onClickStartMeeting();
                      } else {
                        toast("Invalid Meeting ID", {
                          position: "bottom-left",
                          autoClose: 4000,
                          hideProgressBar: true,
                          closeButton: false,
                          pauseOnHover: true,
                          draggable: true,
                          theme: "light",
                        });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security footer */}
        <div className={`flex items-center justify-center gap-2.5 text-[#5e5e61] text-sm font-medium ${
          isMobile ? "py-6" : "absolute bottom-[22px] left-1/2 -translate-x-1/2 whitespace-nowrap"
        }`}>
          <ShieldCheckIcon className="w-4 h-4 shrink-0" />
          <p>Your meeting is secure and encrypted. No one can join unless they are invited.</p>
        </div>
      </div>

      <ConfirmBox
        open={dlgDevices}
        successText="DISMISS"
        onSuccess={() => setDlgDevices(false)}
        title="Mic or webcam not available"
        subTitle="Please connect a mic and webcam to speak and share your video in the meeting. You can also join without them."
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
  const roleLabel = participantMode === participantModes.DOCTOR ? "Doctor" : "Patient";
  const canJoin = participantName.length >= 3 && tokenReady && !credentialError;

  return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      {/* Meeting info */}
      <div className="flex flex-col gap-2 items-center">
        <p className="text-[#5e5e61] text-sm font-medium leading-5">
          Join your Tata 1mg consultation instantly
        </p>
        {credentialError ? (
          <p className="text-sm text-[#dc2626] bg-[#fee2e2] border border-[#fca5a5] rounded-xl px-4 py-3 mt-1">
            {credentialError}
          </p>
        ) : (
          <h2 className="text-black text-2xl font-medium leading-8">
            {meetingTitle || `${roleLabel} Consultation`}
          </h2>
        )}
      </div>

      {/* Name + Join */}
      {!credentialError && (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          {!tokenReady && (
            <p className="text-xs text-[#919093]">Setting up your session…</p>
          )}
          <input
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl text-black text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-450 transition-colors placeholder-[#919093]"
          />
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
