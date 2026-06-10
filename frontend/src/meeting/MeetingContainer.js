import React, { useState, useEffect, useRef, createRef, useCallback } from "react";
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
import { ParticipantDetailsPanel } from "../components/ParticipantDetailsPanel";
import { CustomerVerificationOverlay } from "../components/CustomerVerificationOverlay";
import MobileCustomerCallView from "../components/MobileCustomerCallView";
import NetworkQualityPopup from "../components/NetworkQualityPopup";
import useGeolocation from "../hooks/useGeolocation";
import { getIPGeoInfo } from "../api";

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

  const [showParticipantPanel, setShowParticipantPanel] = useState(false);
  const [meetingErrorVisible, setMeetingErrorVisible] = useState(false);
  const [meetingError, setMeetingError] = useState(false);
  const [localParticipantAllowedJoin, setLocalParticipantAllowedJoin] = useState(null);
  const [meetingState, setMeetingState] = useState("CONNECTED");
  const [qualityLimitation, setQualityLimitation] = useState(null);

  const mMeetingRef = useRef();
  const containerRef = createRef();
  const containerHeightRef = useRef();
  const containerWidthRef = useRef();
  // Set when OS mutes/ends the mic (phone call). Cleared on recovery.
  const silenceWasDetectedRef = useRef(false);

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
    if (status === Constants.recordingEvents.RECORDING_STOPPED) {
      toast("Recording stopped.", {
        position: "bottom-left",
        autoClose: 4000,
        hideProgressBar: true,
        closeButton: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
    }
  };

  function onParticipantJoined(participant) {
    participant && participant.setQuality("high");
  }

  const { getVideoTrack } = useMediaStream();

  async function onMeetingJoined() {
    try {
      const { muteMic, changeMic, changeWebcam, disableWebcam } = mMeetingRef.current;

      if (initialWebcamOn) {
        await new Promise((resolve) => {
          setTimeout(async () => {
            try {
              disableWebcam();
              const track = await getVideoTrack({ webcamId: selectedWebcam.id });
              changeWebcam(track);
            } catch (e) {
              console.warn("Webcam setup failed:", e);
            }
            resolve();
          }, 500);
        });
      }

      if (initialMicOn && selectedMicrophone.id) {
        await new Promise((resolve) => {
          muteMic();
          setTimeout(async () => {
            try {
              const audioTrack = await createMicrophoneAudioTrack({
                encoderConfig: "speech_standard",
                microphoneId: selectedMicrophone.id,
              });
              changeMic(audioTrack);
            } catch (e) {
              console.warn("Mic setup failed:", e);
            }
            resolve();
          }, 500);
        });
      }
    } catch (e) {
      console.warn("onMeetingJoined error:", e);
    } finally {
      setLocalParticipantAllowedJoin(true);
    }
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

  function onParticipantLeft(participant) {}

  function _handleOnMeetingStateChanged(data) {
    const { state } = data;
    setMeetingState(state);
    if (state === "FAILED") {
      toast("Meeting connection failed", {
        position: "bottom-left", autoClose: 5000, type: "warning",
        hideProgressBar: true, closeButton: false, pauseOnHover: true,
        draggable: true, progress: undefined, theme: "dark",
      });
    }
  }

  const isCustomer =
    !participantMode || participantMode === participantModes.CUSTOMER;
  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  const { publish: publishMicSilence } = usePubSub("MIC_SILENCE", {
    onMessageReceived: ({ payload, senderId }) => {
      if (!isDoctor || senderId === mMeetingRef.current?.localParticipant?.id) return;
      if (payload.state === "detected") {
        toast.warn(
          `Patient's mic is silent${payload.devicelabel ? ` — ${payload.devicelabel}` : ""}. They may have an incoming call.`,
          { toastId: "patient-mic-silent", position: "bottom-left", autoClose: false, hideProgressBar: true, closeButton: true, theme: "dark" }
        );
      } else {
        toast.dismiss("patient-mic-silent");
      }
    },
  });

  const onAudioInputSilence = useCallback(({ devicelabel, state }) => {

    console.log("deviceLabel", devicelabel, state);
    

    if (!isCustomer) return;
    const label = devicelabel ? ` — ${devicelabel}` : "";
    if (state === "detected") {
      silenceWasDetectedRef.current = true;
      // Show toast only if the track-level handler hasn't already shown it.
      if (!toast.isActive("own-mic-silent")) {
        toast.warn(
          `Your mic is silent${label}. Incoming call or system mute?`,
          { toastId: "own-mic-silent", position: "bottom-left", autoClose: false, hideProgressBar: true, closeButton: true, theme: "dark" }
        );
      }
      publishMicSilence("MIC_SILENCE", { persist: false }, { state, devicelabel: devicelabel ?? null });
    } else {
      silenceWasDetectedRef.current = false;
      toast.dismiss("own-mic-silent");
      publishMicSilence("MIC_SILENCE", { persist: false }, { state, devicelabel: null });
    }
  }, [isCustomer, publishMicSilence]);

  const _handleOnQualityLimitation = useCallback(({ type, state }) => {
    setQualityLimitation({ type, state });
  }, []);

  const mMeeting = useMeeting({
    onParticipantJoined,
    onParticipantLeft,
    onMeetingJoined,
    onMeetingLeft,
    onMeetingStateChanged: _handleOnMeetingStateChanged,
    onError: _handleOnError,
    onRecordingStateChanged: _handleOnRecordingStateChanged,
    onAudioInputSilence,
    onQualityLimitation: _handleOnQualityLimitation,
  });

  const isPresenting = mMeeting.presenterId ? true : false;

  // Transient connection-status message shown over the patient's video.
  const remoteParticipantCount = [...mMeeting.participants.keys()].filter(
    (id) =>
      id !== mMeeting.localParticipant?.id &&
      mMeeting.participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  ).length;
  const statusMessage =
    meetingState === "CONNECTING" || meetingState === "DISCONNECTED"
      ? "Reconnecting…"
      : remoteParticipantCount === 0
      ? "Waiting for Other Participant…"
      : null;

  useEffect(() => {
    mMeetingRef.current = mMeeting;
  }, [mMeeting]);

  const { publish: publishDeviceInfo } = usePubSub("DEVICE_INFO", {});

  useEffect(() => {
    if (!localParticipantAllowedJoin || !isCustomer) return;

    const collectAndPublish = async () => {
      // ── Phase 1: publish device/mic/camera info immediately (fast) ───────────
      let cameras = [], microphones = [], audioOutputs = [];
      let selectedCameraLabel = null, selectedMicLabel = null;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices  = devices.filter(d => d.kind === "videoinput");
        const audioDevices  = devices.filter(d => d.kind === "audioinput");
        const outputDevices = devices.filter(d => d.kind === "audiooutput");
        cameras      = videoDevices.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        microphones  = audioDevices.map((d, i) => d.label || `Mic ${i + 1}`);
        audioOutputs = outputDevices.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }));
        const selCam = videoDevices.find(d => d.deviceId === selectedWebcam?.id);
        const selMic = audioDevices.find(d => d.deviceId === selectedMicrophone?.id);
        selectedCameraLabel = selCam?.label || cameras[0]?.label || null;
        selectedMicLabel    = selMic?.label || microphones[0] || null;
      } catch (_) {}

      try {
        publishDeviceInfo("DEVICE_INFO", { persist: true }, {
          userAgent: navigator.userAgent,
          selectedCameraLabel,
          selectedMicLabel,
          connection: navigator.connection?.effectiveType ?? "unknown",
          cameras,
          microphones,
          audioOutputs,
        });
      } catch (err) {
        console.error("Error publishing device info (phase 1):", err);
      }

      // ── Phase 2: enrich with network stats + geo (slow, runs in background) ──
      let downloadSpeed, uploadSpeed;
      try {
        const stats = await getNetworkStats({ timeoutDuration: 8000 });
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
          audioOutputs,
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
        console.error("Error publishing device info (phase 2):", err);
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

  const { publish: publishGeoFailed } = usePubSub("GEO_FAILED", {});

  usePubSub("GEO_RETRY", {
    onMessageReceived: ({ senderId }) => {
      if (!isCustomer) return;
      if (senderId === mMeetingRef.current?.localParticipant?.id) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          publishGeoTag("GEO_TAG", { persist: true }, { latitude: lat, longitude: lng, timestamp: Date.now() });
        },
        () => {
          getIPGeoInfo().then((info) => {
            if (!info?.latitude || !info?.longitude) {
              publishGeoFailed("GEO_FAILED", { persist: true }, {});
              return;
            }
            publishGeoTag("GEO_TAG", { persist: true }, {
              latitude: info.latitude, longitude: info.longitude,
              timestamp: Date.now(),
              address: [info.city, info.region, info.country].filter(Boolean).join(", "),
              isIPBased: true,
            });
          });
        }
      );
    },
  });

  const geoAckToastedRef = useRef(false);
  usePubSub("GEO_ACK", {
    onMessageReceived: () => {
      if (!isDoctor || geoAckToastedRef.current) return;
      geoAckToastedRef.current = true;
      toast.success("Geo cordinate data has been confirmed by recording template.", {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: true,
        closeButton: true,
        theme: "dark",
      });
    },
    onOldMessagesReceived: () => {},
  });


  const { latitude, longitude, timestamp, error: geoError } = useGeolocation({ enabled: isCustomer });

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
      if (!info?.latitude || !info?.longitude) {
        publishGeoFailed("GEO_FAILED", { persist: true }, {});
        return;
      }
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

  // Attach mute/unmute/ended listeners directly on the local audio track so the
  // "Incoming call" toast fires immediately instead of waiting up to 5 s for the
  // SDK's silence-detection poll (AUDIO_SILENCE_POLL_MS = 5000 in js-sdk).
  useEffect(() => {
    if (!localParticipantAllowedJoin || !isCustomer) return;

    const tryAttach = () => {
      const participant = mMeetingRef.current?.localParticipant;
      if (!participant?.streams) return null;
      let track = null;
      participant.streams.forEach((stream) => {
        if (stream.kind === "audio") track = stream.track;
      });
      if (!track || track.readyState !== "live") return null;

      const onMute = () => {
        silenceWasDetectedRef.current = true;
        if (!toast.isActive("own-mic-silent")) {
          toast.warn("Your mic is silent. Incoming call or system mute?", {
            toastId: "own-mic-silent",
            position: "bottom-left", autoClose: false, hideProgressBar: true, closeButton: true, theme: "dark",
          });
        }
      };
      const onUnmute = () => {
        // Don't clear the ref here — let the devicechange restart handler do it
        // so the restart logic still fires when the OS releases devices.
        toast.dismiss("own-mic-silent");
      };
      const onEnded = () => {
        silenceWasDetectedRef.current = true;
      };

      track.addEventListener("mute", onMute);
      track.addEventListener("unmute", onUnmute);
      track.addEventListener("ended", onEnded);
      return () => {
        track.removeEventListener("mute", onMute);
        track.removeEventListener("unmute", onUnmute);
        track.removeEventListener("ended", onEnded);
      };
    };

    let detach = tryAttach();
    // Retry once — streams may not be populated synchronously on join.
    const t = setTimeout(() => { detach?.(); detach = tryAttach(); }, 800);
    return () => { clearTimeout(t); detach?.(); };
  }, [localParticipantAllowedJoin, isCustomer]);

  // When the OS releases the audio/video session after a phone call, auto-restart
  // mic and webcam so the user doesn't have to toggle them manually.
  useEffect(() => {
    if (!localParticipantAllowedJoin || !isCustomer) return;

    const restartAfterInterruption = async () => {
      if (!silenceWasDetectedRef.current) return;
      silenceWasDetectedRef.current = false;
      toast.dismiss("own-mic-silent");
      // Explicitly tell the doctor the mic is back. After changeMic() the SDK
      // starts a fresh silence monitor (emitted=false) so onAudioInputSilence
      // "resolved" never fires for the previous "detected" — the doctor's toast
      // would be stuck without this publish.
      publishMicSilence("MIC_SILENCE", { persist: false }, { state: "resolved", devicelabel: null });

      const meeting = mMeetingRef.current;
      if (!meeting) return;

      if (meeting.localMicOn) {
        try {
          const audioTrack = await createMicrophoneAudioTrack({
            encoderConfig: "speech_standard",
            microphoneId: selectedMicrophone?.id,
          });
          meeting.changeMic(audioTrack);
        } catch (e) {
          console.warn("Mic restart after interruption failed:", e);
        }
      }

      if (meeting.localWebcamOn) {
        try {
          meeting.disableWebcam();
          await new Promise((r) => setTimeout(r, 300));
          const videoTrack = await getVideoTrack({ webcamId: selectedWebcam?.id });
          if (videoTrack) meeting.changeWebcam(videoTrack);
        } catch (e) {
          console.warn("Webcam restart after interruption failed:", e);
        }
      }
    };

    navigator.mediaDevices?.addEventListener("devicechange", restartAfterInterruption);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", restartAfterInterruption);
  }, [localParticipantAllowedJoin, isCustomer, selectedMicrophone, selectedWebcam, getVideoTrack, publishMicSilence]);

  return (
    <div className="fixed inset-0">
      <div ref={containerRef} className={`h-full w-full flex flex-col relative ${localParticipantAllowedJoin ? "bg-[#1b1b1e]" : "bg-transparent"}`}>
        {localParticipantAllowedJoin ? (
            <>
              <NetworkQualityPopup limitation={qualityLimitation} />
              <ImageUploadListner />
              <ResolutionListner />
              <SwitchCameraListner />

              {isDoctor ? (
                <DoctorView />
              ) : isMobile ? (
                /* ── Mobile customer: full Figma layout ───────────────────── */
                <MobileCustomerCallView
                  meetingTitle={new URLSearchParams(window.location.search).get("meetingTitle") || ""}
                  statusMessage={statusMessage}
                />
              ) : (
                /* ── Desktop customer: existing layout ────────────────────── */
                <>
                  <TopBar
                    bottomBarHeight={bottomBarHeight}
                    caseId={caseId}
                    meetingTitle={new URLSearchParams(window.location.search).get("meetingTitle") || ""}
                    onToggleParticipantPanel={() => setShowParticipantPanel((s) => !s)}
                  />

                  <div className={`relative flex flex-1 ${isPresenting ? "flex-row" : "flex-row"} bg-[#1b1b1e] overflow-hidden`}>
                    {isPresenting ? <PresenterView height={containerHeight - bottomBarHeight * 2} /> : null}
                    <MemorizedParticipantView isPresenting={isPresenting} sideBarMode={sideBarMode} statusMessage={statusMessage} />
                    <div>
                      <SidebarConatiner
                        height={containerHeight - bottomBarHeight * 2}
                        sideBarContainerWidth={sideBarContainerWidth}
                      />
                    </div>
                    {showParticipantPanel && (
                      <div className="shrink-0 h-full">
                        <ParticipantDetailsPanel onClose={() => setShowParticipantPanel(false)} />
                      </div>
                    )}
                    <CustomerVerificationOverlay />
                  </div>

                  <BottomBar bottomBarHeight={bottomBarHeight} />
                </>
              )}
            </>
        ) : (
          <WaitingToJoinScreen />
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
