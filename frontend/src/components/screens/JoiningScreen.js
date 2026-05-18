import React, { useEffect, useRef, useState } from "react";
import { MeetingDetailsScreen } from "../MeetingDetailsScreen";
import { createMeeting, getToken, validateMeeting } from "../../api";
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

  const isCustomer = participantMode === participantModes.CUSTOMER;
  // Always show PermissionSetup for both doctor and patient — everyone does a pre-call check.
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
  const [dlgMuted, setDlgMuted] = useState(false);
  const [dlgDevices, setDlgDevices] = useState(false);
  const [didDeviceChange, setDidDeviceChange] = useState(false);
  const [testSpeaker, setTestSpeaker] = useState(false)


  const videoPlayerRef = useRef();
  const audioPlayerRef = useRef();
  const videoTrackRef = useRef();
  const audioTrackRef = useRef();
  const audioAnalyserIntervalRef = useRef();
  const permissonAvaialble = useRef();
  const webcamRef = useRef();
  const micRef = useRef();

  useEffect(() => {
    webcamRef.current = webcamOn;
  }, [webcamOn]);

  useEffect(() => {
    micRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    permissonAvaialble.current = {
      isCameraPermissionAllowed,
      isMicrophonePermissionAllowed,
    };
  }, [isCameraPermissionAllowed, isMicrophonePermissionAllowed]);

  useEffect(() => {
    if (micOn) {
      audioTrackRef.current = audioTrack;
      startMuteListener();
    }
  }, [micOn, audioTrack]);

  useEffect(() => {
    if (micOn) {
      // Close the existing audio track if there's a new one
      if (audioTrackRef.current && audioTrackRef.current !== audioTrack) {
        audioTrackRef.current.stop();
      }

      audioTrackRef.current = audioTrack;

      if (audioTrack) {
        const audioSrcObject = new MediaStream([audioTrack]);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.srcObject = audioSrcObject;
          audioPlayerRef.current
            .play()
            .catch((error) => console.log("audio play error", error));
        }
      } else {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.srcObject = null;
        }
      }
    }
  }, [micOn, audioTrack]);

  useEffect(() => {
    if (webcamOn) {
      videoTrackRef.current = videoTrack;

      var isPlaying =
        videoPlayerRef.current.currentTime > 0 &&
        !videoPlayerRef.current.paused &&
        !videoPlayerRef.current.ended &&
        videoPlayerRef.current.readyState >
        videoPlayerRef.current.HAVE_CURRENT_DATA;

      if (videoTrack) {
        const videoSrcObject = new MediaStream([videoTrack]);

        if (videoPlayerRef.current) {
          videoPlayerRef.current.srcObject = videoSrcObject;
          if (videoPlayerRef.current.pause && !isPlaying) {
            videoPlayerRef.current
              .play()
              .catch((error) => console.log("error", error));
          }
        }
      } else {
        if (videoPlayerRef.current) {
          videoPlayerRef.current.srcObject = null;
        }
      }
    }
  }, [webcamOn, videoTrack]);

  useEffect(() => {
    getCameraDevices();
  }, [isCameraPermissionAllowed]);

  useEffect(() => {
    getAudioDevices();
  }, [isMicrophonePermissionAllowed]);

  useEffect(() => {
    if (permissionDone) checkMediaPermission();
    return () => { };
  }, [permissionDone]);

  const _toggleWebcam = () => {
    const videoTrack = videoTrackRef.current;

    if (webcamOn) {
      if (videoTrack) {
        videoTrack.stop();
        setVideoTrack(null);
        setCustomVideoStream(null);
        setWebcamOn(false);
      }
    } else {
      getDefaultMediaTracks({ mic: false, webcam: true });
      setWebcamOn(true);
    }
  };

  const _toggleMic = () => {
    const audioTrack = audioTrackRef.current;

    if (micOn) {
      if (audioTrack) {
        audioTrack.stop();
        setAudioTrack(null);
        setCustomAudioStream(null);
        setMicOn(false);
        setSpekerOn(false);
      }
    } else {
      getDefaultMediaTracks({ mic: true, webcam: false });
      setMicOn(true);
      setSpekerOn(true);
    }
  };

  const changeWebcam = async (deviceId) => {
    if (webcamOn) {
      const currentvideoTrack = videoTrackRef.current;
      if (currentvideoTrack) {
        currentvideoTrack.stop();
      }

      const stream = await getVideoTrack({
        webcamId: deviceId,
      });
      setCustomVideoStream(stream);
      const videoTracks = stream?.getVideoTracks();
      const videoTrack = videoTracks.length ? videoTracks[0] : null;
      setVideoTrack(videoTrack);
    }
  };
  const changeMic = async (deviceId) => {
    if (micOn) {
      const currentAudioTrack = audioTrackRef.current;
      currentAudioTrack && currentAudioTrack.stop();
      const stream = await getAudioTrack({
        micId: deviceId,
      });
      setCustomAudioStream(stream);
      const audioTracks = stream?.getAudioTracks();
      const audioTrack = audioTracks.length ? audioTracks[0] : null;
      clearInterval(audioAnalyserIntervalRef.current);
      setAudioTrack(audioTrack);
    }
  };

  const getDefaultMediaTracks = async ({ mic, webcam }) => {
    if (mic) {
      const stream = await getAudioTrack({
        micId: selectedMicrophone?.id,
      });
      setCustomAudioStream(stream);
      const audioTracks = stream?.getAudioTracks();
      const audioTrack = audioTracks?.length ? audioTracks[0] : null;
      setAudioTrack(audioTrack);
    }

    if (webcam) {
      const stream = await getVideoTrack({
        webcamId: selectedWebcam?.id,
      });
      setCustomVideoStream(stream);
      const videoTracks = stream?.getVideoTracks();
      const videoTrack = videoTracks.length ? videoTracks[0] : null;
      setVideoTrack(videoTrack);
    }
  };

  async function startMuteListener() {
    const currentAudioTrack = audioTrackRef.current;
    if (currentAudioTrack) {
      if (currentAudioTrack.muted) {
        setDlgMuted(true);
      }
      currentAudioTrack.addEventListener("mute", (ev) => {
        setDlgMuted(true);
      });
    }
  }

  async function requestAudioVideoPermission(mediaType) {
    try {
      const permission = await requestPermission(mediaType);

      if (mediaType === Constants.permission.AUDIO) {
        setIsMicrophonePermissionAllowed(
          permission.get(Constants.permission.AUDIO)
        );
      }

      if (mediaType === Constants.permission.VIDEO) {
        setIsCameraPermissionAllowed(
          permission.get(Constants.permission.VIDEO)
        );
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
      console.log("Error in requestPermission ", ex);
    }
  }
  function onDeviceChanged() {
    setDidDeviceChange(true);
    getCameraDevices();
    getAudioDevices();
    getDefaultMediaTracks({ mic: micRef.current, webcam: webcamRef.current });
  }

  const checkMediaPermission = async () => {
    const checkAudioVideoPermission = await checkPermissions();
    const cameraPermissionAllowed = checkAudioVideoPermission.get(
      Constants.permission.VIDEO
    );
    const microphonePermissionAllowed = checkAudioVideoPermission.get(
      Constants.permission.AUDIO
    );

    setIsCameraPermissionAllowed(cameraPermissionAllowed);
    setIsMicrophonePermissionAllowed(microphonePermissionAllowed);

    if (microphonePermissionAllowed) {
      setMicOn(true);
      getDefaultMediaTracks({ mic: true, webcam: false });
    } else {
      await requestAudioVideoPermission(Constants.permission.AUDIO);
    }
    if (cameraPermissionAllowed) {
      setWebcamOn(true);
      getDefaultMediaTracks({ mic: false, webcam: true });
    } else {
      await requestAudioVideoPermission(Constants.permission.VIDEO);
    }
  };

  const getCameraDevices = async () => {
    try {
      if (permissonAvaialble.current?.isCameraPermissionAllowed) {
        let webcams = await getCameras();
        setSelectedWebcam({
          id: webcams[0]?.deviceId,
          label: webcams[0]?.label,
        });
        setDevices((devices) => {
          return { ...devices, webcams };
        });
      }
    } catch (err) {
      console.log("Error in getting camera devices", err);
    }
  };

  const getAudioDevices = async () => {
    try {
      if (permissonAvaialble.current?.isMicrophonePermissionAllowed) {
        let mics = await getMicrophones();
        let speakers = await getPlaybackDevices();
        const hasMic = mics.length > 0;
        if (hasMic) {
          startMuteListener();
        }

        setSelectedSpeaker({
          id: speakers[0]?.deviceId,
          label: speakers[0]?.label,
        });
        setSelectedMicroPhone({ id: mics[0]?.deviceId, label: mics[0]?.label });

        setDevices((devices) => {
          return { ...devices, mics, speakers };
        });
      }
    } catch (err) {
      console.log("Error in getting audio devices", err);
    }
  };

  const ButtonWithTooltip = ({ onClick, onState, OnIcon, OffIcon }) => {
    return (
      <button
        onClick={onClick}
        className={`rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all ${
          onState ? "bg-orange-450 hover:bg-orange-500" : "bg-red-650 hover:bg-red-500"
        }`}
      >
        {onState ? <OnIcon fillcolor="white" /> : <OffIcon fillcolor="white" />}
      </button>
    );
  };

  return (
    <>
      {!permissionDone && (
        <PermissionSetup onDone={() => setPermissionDone(true)} />
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col overflow-y-auto">
        {/* Orange header */}
        <header className="bg-orange-450 px-5 py-3 flex items-center gap-3 shrink-0 shadow-md">
          <img
            src="https://play-lh.googleusercontent.com/yjbAu08_Ahes38IEMV8slP91zgjh2mdh5xpZefvcbYuZxR8O7FZFderRn2Ivaz0uR2Lw"
            alt="Tata 1mg"
            className="w-9 h-9 rounded-xl object-contain"
          />
          <div className="leading-none">
            <p className="text-white font-bold text-sm">Tata 1mg</p>
            <p className="text-white/70 text-xs mt-0.5">Video MER</p>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 items-start md:items-center justify-center px-4 py-8 md:py-10">
          <div className="w-full max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Left column: one unified card (video on top, device bar on bottom) */}
              <div className="md:col-span-7">
                {/*
                  overflow-hidden is NOT on the outer card so dropdown panels
                  opened with `absolute bottom-full` can escape upward.
                  It IS on the inner video wrapper to round the top corners.
                */}
                <div className="rounded-2xl shadow-md border border-gray-200 bg-white">

                  {/* Video area — own overflow-hidden keeps the dark bg clipped to rounded-t corners */}
                  <div className="rounded-t-2xl overflow-hidden relative bg-gray-900" style={{ height: isMobile ? "52vw" : 300, minHeight: 180 }}>
                    <div className={`absolute z-10 ${isMobile ? "right-2 top-2" : "right-3 top-3"}`}>
                      <NetworkStats />
                    </div>
                    {isMobile && (
                      <audio autoPlay playsInline muted={!testSpeaker} ref={audioPlayerRef} controls={false} />
                    )}
                    <video
                      autoPlay playsInline muted ref={videoPlayerRef} controls={false}
                      style={{ backgroundColor: "#111827" }}
                      className="h-full w-full object-cover flip"
                    />
                    <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                      {isMicrophonePermissionAllowed ? (
                        <ButtonWithTooltip onClick={_toggleMic} onState={micOn} mic={true} OnIcon={MicOnIcon} OffIcon={MicOffIcon} />
                      ) : (
                        <MicPermissionDenied />
                      )}
                      {isCameraPermissionAllowed ? (
                        <ButtonWithTooltip onClick={_toggleWebcam} onState={webcamOn} mic={false} OnIcon={WebcamOnIcon} OffIcon={WebcamOffIcon} />
                      ) : (
                        <CameraPermissionDenied />
                      )}
                    </div>
                  </div>

                  {/* Device selectors — inside the card, no overflow-hidden */}
                  <div className="rounded-b-2xl border-t border-gray-100 bg-white px-4 py-3">
                    <div className={`flex gap-2 ${isMobile ? "flex-col" : "flex-row"}`}>
                      <div className={isMobile ? "w-full" : "flex-1 min-w-0"}>
                        <DropDownMic
                          mics={mics}
                          changeMic={changeMic}
                          customAudioStream={customAudioStream}
                          audioTrack={audioTrack}
                          micOn={micOn}
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

                </div>
              </div>

              {/* Right column: meeting form */}
              <div className="md:col-span-5">
                <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 h-full flex flex-col justify-center">
                  <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-800">Ready to join?</h2>
                    <p className="text-gray-500 text-sm mt-1">Enter your details to join the consultation</p>
                  </div>
                  <MeetingDetailsScreen
                    participantName={participantName}
                    setParticipantName={setParticipantName}
                    onClickStartMeeting={onClickStartMeeting}
                    onClickJoin={async (id) => {
                      const token = await getToken();
                      setToken(token);
                      const valid = await validateMeeting({ roomId: id, token });
                      if (valid) {
                        setMeetingId(id);
                        onClickStartMeeting();
                      } else {
                        toast(`Invalid Meeting ID`, {
                          position: "bottom-left",
                          autoClose: 4000,
                          hideProgressBar: true,
                          closeButton: false,
                          pauseOnHover: true,
                          draggable: true,
                          progress: undefined,
                          theme: "light",
                        });
                      }
                    }}
                    _handleOnCreateMeeting={async () => {
                      const token = await getToken();
                      setToken(token);
                      const _meetingId = await createMeeting({ token });
                      setMeetingId(_meetingId);
                      return _meetingId;
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmBox
        open={dlgMuted}
        successText="OKAY"
        onSuccess={() => {
          setDlgMuted(false);
        }}
        title="System mic is muted"
        subTitle="You're default microphone is muted, please unmute it or increase audio
            input volume from system settings."
      />

      <ConfirmBox
        open={dlgDevices}
        successText="DISMISS"
        onSuccess={() => {
          setDlgDevices(false);
        }}
        title="Mic or webcam not available"
        subTitle="Please connect a mic and webcam to speak and share your video in the meeting. You can also join without them."
      />
    </>
  );
}
