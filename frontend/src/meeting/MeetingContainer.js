import React, { useState, useEffect, useRef, createRef } from "react";
import {
  Constants,
  createMicrophoneAudioTrack,
  getNetworkStats,
  useMeeting,
  usePubSub,
} from "@videosdk.live/react-sdk";
import { BottomBar } from "./components/BottomBar";
import { SidebarConatiner } from "../components/sidebar/SidebarContainer";
import MemorizedParticipantView from "./components/ParticipantView";
import { PresenterView } from "../components/PresenterView";
import DoctorView from "../components/doctor/DoctorView";
import { nameTructed, trimSnackBarText } from "../utils/helper";
import WaitingToJoinScreen from "../components/screens/WaitingToJoinScreen";
import ConfirmBox from "../components/ConfirmBox";
import useIsMobile from "../hooks/useIsMobile";
import useIsTab from "../hooks/useIsTab";
import { useMediaQuery } from "react-responsive";
import { toast } from "react-toastify";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import useMediaStream from "../hooks/useMediaStream";
import { meetingLeftReasons, participantModes } from "../utils/common";
import ResolutionListner from "../components/ResolutionListner";
import SwitchCameraListner from "../components/SwitchCameraListner";
import ImageUploadListner from "../components/ImageUploadListner";
import { TopBar } from "./components/TopBar";
import useGeolocation from "../hooks/useGeolocation";
import { getIPGeoInfo } from "../api";
import { MicSilenceBanner } from "../components/ui/MicSilenceBanner";
import { useAudioInputSilence } from "../hooks/useAudioInputSilence";

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "Tata1mg-VideoMER/1.0" } }
    );
    const data = await res.json();
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

export function MeetingContainer({ onMeetingLeave }) {
  const bottomBarHeight = 60;

  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const {
    sideBarMode,
    initialMicOn,
    initialWebcamOn,
    selectedWebcam,
    selectedMicrophone,
    participantLeftReason,
    setParticipantLeftReason,
    participantMode,
    caseId,
    setGeoData,
  } = useMeetingAppContext();

  const [meetingErrorVisible, setMeetingErrorVisible] = useState(false);
  const [meetingError, setMeetingError] = useState(false);
  const [localParticipantAllowedJoin, setLocalParticipantAllowedJoin] = useState(null);

  const mMeetingRef = useRef();
  const containerRef = createRef();
  const containerHeightRef = useRef();
  const containerWidthRef = useRef();

  useEffect(() => {
    containerHeightRef.current = containerHeight;
    containerWidthRef.current = containerWidth;
  }, [containerHeight, containerWidth]);

  const isMobile = useIsMobile();
  const isTab = useIsTab();
  const isLGDesktop = useMediaQuery({ minWidth: 1024, maxWidth: 1439 });
  const isXLDesktop = useMediaQuery({ minWidth: 1440 });

  const sideBarContainerWidth = isXLDesktop ? 400 : isLGDesktop ? 360 : isTab ? 320 : isMobile ? 280 : 240;

  useEffect(() => {
    containerRef.current?.offsetHeight &&
      setContainerHeight(containerRef.current.offsetHeight);
    containerRef.current?.offsetWidth &&
      setContainerWidth(containerRef.current.offsetWidth);

    window.addEventListener("resize", () => {
      containerRef.current?.offsetHeight &&
        setContainerHeight(containerRef.current.offsetHeight);
      containerRef.current?.offsetWidth &&
        setContainerWidth(containerRef.current.offsetWidth);
    });
  }, []);

  const _handleOnRecordingStateChanged = ({ status }) => {
    if (
      status === Constants.recordingEvents.RECORDING_STARTED ||
      status === Constants.recordingEvents.RECORDING_STOPPED
    ) {
      toast(
        status === Constants.recordingEvents.RECORDING_STARTED
          ? "Recording started"
          : "Recording stopped.",
        {
          position: "bottom-left",
          autoClose: 4000,
          hideProgressBar: true,
          closeButton: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        }
      );
    }
  };

  function onParticipantJoined(participant) {
    participant && participant.setQuality("high");
  }

  const { getVideoTrack } = useMediaStream();

  async function onMeetingJoined() {
    const { muteMic, changeMic, changeWebcam, disableWebcam } = mMeetingRef.current;

    if (initialWebcamOn) {
      await new Promise((resolve) => {
        setTimeout(async () => {
          disableWebcam();
          const track = await getVideoTrack({ webcamId: selectedWebcam.id });
          changeWebcam(track);
          resolve();
        }, 500);
      });
    }

    if (initialMicOn && selectedMicrophone.id) {
      await new Promise((resolve) => {
        muteMic();
        setTimeout(async () => {
          const audioTrack = await createMicrophoneAudioTrack({
            encoderConfig: "speech_standard",
            microphoneId: selectedMicrophone.id,
          });
          changeMic(audioTrack);
          resolve();
        }, 500);
      });
    }

    setLocalParticipantAllowedJoin(true);
  }

  function onMeetingLeft() {
    onMeetingLeave();
  }

  const _handleOnError = (data) => {
    const { code, message } = data;
    const joiningErrCodes = [4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010];
    const isJoiningError = joiningErrCodes.findIndex((c) => c === code) !== -1;
    const isCriticalError = `${code}`.startsWith("500");

    new Audio(
      isCriticalError
        ? `https://static.videosdk.live/prebuilt/notification_critical_err.mp3`
        : `https://static.videosdk.live/prebuilt/notification_err.mp3`
    ).play();

    setMeetingErrorVisible(true);
    setMeetingError({ code, message: isJoiningError ? "Unable to join meeting!" : message });
  };

  function onParticipantLeft(participant) {
    toast(
      `${trimSnackBarText(nameTructed(participant.displayName, 15))} ${
        participantLeftReason === meetingLeftReasons.TAB_BROWSER_CLOSED
          ? "left because of tab closed."
          : "left the meeting."
      }`,
      {
        position: "bottom-left",
        autoClose: 4000,
        hideProgressBar: true,
        closeButton: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      }
    );
  }

  function _handleOnMeetingStateChanged(data) {
    const { state } = data;
    const msg =
      state === "CONNECTED" ? "Meeting is connected"
      : state === "CONNECTING" ? "Meeting is connecting"
      : state === "FAILED" ? "Meeting connection failed"
      : state === "DISCONNECTED" ? "Meeting connection disconnected abruptly"
      : state === "CLOSING" ? "Meeting is closing"
      : state === "CLOSED" ? "Meeting connection closed"
      : "";
    if (msg) toast(msg, {
      position: "bottom-left", autoClose: 5000,
      type: (state === "FAILED" || state === "DISCONNECTED") ? "warning" : undefined,
      hideProgressBar: true, closeButton: false, pauseOnHover: true,
      draggable: true, progress: undefined, theme: "light",
    });
  }

  const { isSilent, deviceLabel, onAudioInputSilence  } = useAudioInputSilence();


  const mMeeting = useMeeting({
    onParticipantJoined,
    onParticipantLeft,
    onMeetingJoined,
    onMeetingLeft,
    onMeetingStateChanged: _handleOnMeetingStateChanged,
    onError: _handleOnError,
    onRecordingStateChanged: _handleOnRecordingStateChanged,
    onAudioInputSilence,
  });

  const isPresenting = mMeeting.presenterId ? true : false;

  useEffect(() => {
    mMeetingRef.current = mMeeting;
  }, [mMeeting]);

  // Auto geo broadcast: customer publishes location, doctor receives and stores
  const isCustomer =
    !participantMode || participantMode === participantModes.CUSTOMER;
  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  const { publish: publishDeviceInfo } = usePubSub("DEVICE_INFO", {});

  useEffect(() => {
    if (!localParticipantAllowedJoin || !isCustomer) return;

    const collectAndPublish = async () => {
      let cameras = [], microphones = [];
      let selectedCameraLabel = null, selectedMicLabel = null;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === "videoinput");
        const audioDevices = devices.filter(d => d.kind === "audioinput");
        cameras = videoDevices.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        microphones = audioDevices.map((d, i) => d.label || `Mic ${i + 1}`);
        const selCam = videoDevices.find(d => d.deviceId === selectedWebcam?.id);
        const selMic = audioDevices.find(d => d.deviceId === selectedMicrophone?.id);
        selectedCameraLabel = selCam?.label || cameras[0]?.label || null;
        selectedMicLabel = selMic?.label || microphones[0] || null;
      } catch (_) {}

      let downloadSpeed, uploadSpeed;
      try {
        const stats = await getNetworkStats({ timeoutDuration: 15000 });
        downloadSpeed = stats.downloadSpeed;
        uploadSpeed = stats.uploadSpeed;
      } catch (_) {}

      const ipGeo = await getIPGeoInfo();

      try {
        publishDeviceInfo("DEVICE_INFO", { persist: true }, {
          userAgent: navigator.userAgent,
          selectedCameraLabel,
          selectedMicLabel,
          connection: navigator.connection?.effectiveType ?? "unknown",
          cameras,
          microphones,
          downloadSpeed,
          uploadSpeed,
          city: ipGeo?.city,
          region: ipGeo?.region,
          country: ipGeo?.country,
          isp: ipGeo?.org,
          ip: ipGeo?.ip,
          timezone: ipGeo?.timezone,
        });
      } catch (err) {
        console.error("Error publishing device info:", err);
      }
    };

    collectAndPublish();
  }, [localParticipantAllowedJoin]);

  const { publish: publishGeoTag } = usePubSub("GEO_TAG", {
    onMessageReceived: ({ payload, senderId }) => {
      if (senderId === mMeetingRef.current?.localParticipant?.id) return;
      if (isDoctor) setGeoData(payload);
    },
    onOldMessagesReceived: (messages) => {
      if (!isDoctor) return;
      const latest = messages[messages.length - 1];
      if (latest?.payload) setGeoData(latest.payload);
    },
  });

  usePubSub("GEO_ACK", {
    onMessageReceived: () => {
      if (!isDoctor) return;
      toast.success("Geo cordinate data has been confirmed by recording template.", {
        position: "top-right",
        autoClose: false,
        hideProgressBar: true,
        closeButton: true,
        theme: "light",
      });
    },
    onOldMessagesReceived: () => {},
  });

  const { latitude, longitude, timestamp, error: geoError } = useGeolocation();

  const lastGeoPublishAtRef = useRef(0);
  const lastGeoKeyRef = useRef(null);

  useEffect(() => {
    if (!latitude || !longitude || !localParticipantAllowedJoin || !isCustomer) return;

    const lat = Number(latitude.toFixed(6));
    const lng = Number(longitude.toFixed(6));
    const key = `${lat},${lng}`;
    const now = Date.now();

    if (lastGeoKeyRef.current === key || now - lastGeoPublishAtRef.current < 5000) return;

    lastGeoPublishAtRef.current = now;
    lastGeoKeyRef.current = key;

    (async () => {
      try {
        const address = await reverseGeocode(lat, lng);
        publishGeoTag("GEO_TAG", { persist: true }, { latitude: lat, longitude: lng, timestamp: timestamp ?? now, address });
      } catch (err) {
        console.error("Error publishing geo tag:", err);
      }
    })();
  }, [latitude, longitude, timestamp, localParticipantAllowedJoin]);

  // IP-based geo fallback: fires when GPS is denied or unavailable
  useEffect(() => {
    if (!localParticipantAllowedJoin || !isCustomer || latitude || !geoError) return;
    getIPGeoInfo().then((info) => {
      if (!info?.latitude || !info?.longitude) return;
      publishGeoTag("GEO_TAG", { persist: true }, {
        latitude: info.latitude,
        longitude: info.longitude,
        timestamp: Date.now(),
        address: [info.city, info.region, info.country].filter(Boolean).join(", "),
        isIPBased: true,
      });
    });
  }, [geoError, localParticipantAllowedJoin]);

  useEffect(() => {
    window.addEventListener("beforeunload", (event) => {
      setParticipantLeftReason(meetingLeftReasons.TAB_BROWSER_CLOSED);
      event.preventDefault();
      event.returnValue = "";
    });
  }, []);

  return (
    <div className="fixed inset-0">
      <div ref={containerRef} className="h-full w-full flex flex-col bg-gray-800 relative">
        {typeof localParticipantAllowedJoin === "boolean" ? (
          localParticipantAllowedJoin ? (
            <>
              <MicSilenceBanner isSilent={isSilent} deviceLabel={deviceLabel} />
              <ImageUploadListner />
              <ResolutionListner />
              <SwitchCameraListner />

              {isDoctor ? (
                <DoctorView />
              ) : (
                <>
                  <TopBar bottomBarHeight={bottomBarHeight} caseId={caseId} />

                  <div className={`flex flex-1 ${isPresenting && isMobile ? "flex-col md:flex-row" : "flex-row"} bg-gray-800 overflow-hidden`}>
                    {isPresenting && isMobile ? (
                      <div className="flex flex-1 flex-col">
                        <div className="flex flex-1">
                          <PresenterView height={containerHeight - bottomBarHeight * 2} />
                        </div>
                        <div className="flex h-1/3 md:flex-1">
                          <MemorizedParticipantView isPresenting={isPresenting} sideBarMode={sideBarMode} />
                        </div>
                      </div>
                    ) : (
                      <>
                        {isPresenting ? <PresenterView height={containerHeight - bottomBarHeight * 2} /> : null}
                        <MemorizedParticipantView isPresenting={isPresenting} sideBarMode={sideBarMode} />
                      </>
                    )}
                    <div>
                      <SidebarConatiner
                        height={containerHeight - bottomBarHeight * 2}
                        sideBarContainerWidth={sideBarContainerWidth}
                      />
                    </div>
                  </div>

                  <BottomBar bottomBarHeight={bottomBarHeight} />
                </>
              )}
            </>
          ) : null
        ) : (
          !mMeeting.isMeetingJoined && <WaitingToJoinScreen />
        )}

        <ConfirmBox
          open={meetingErrorVisible}
          successText="OKAY"
          onSuccess={() => setMeetingErrorVisible(false)}
          title={`Error Code: ${meetingError.code}`}
          subTitle={meetingError.message}
        />
      </div>
    </div>
  );
}
