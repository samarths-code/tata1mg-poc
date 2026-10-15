import React, { useState, useEffect, useRef, createRef, useCallback } from "react";
import {
  Constants,
  useMeeting,
  usePubSub,
} from "@videosdk.live/react-sdk";
import { BottomBar } from "./components/BottomBar";
import MemorizedParticipantView from "./components/ParticipantView";
import DoctorView from "../components/doctor/DoctorView";
import WaitingToJoinScreen from "../components/screens/WaitingToJoinScreen";
import ConfirmBox from "../components/ConfirmBox";
import useIsMobile from "../hooks/useIsMobile";
import { toast } from "react-toastify";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import { createAudioTrack, createVideoTrack } from "../hooks/useMediaStream";
import { meetingLeftReasons, participantModes } from "../utils/common";
import ImageUploadListner from "../components/ImageUploadListner";
import { TopBar } from "./components/TopBar";
import { ParticipantDetailsPanel } from "../components/ParticipantDetailsPanel";
import MobileCustomerCallView from "../components/MobileCustomerCallView";
import NetworkAlerts from "../components/NetworkAlerts";
import useNetworkWatch from "../hooks/useNetworkWatch";
import useGeolocation from "../hooks/useGeolocation";
import { getIPGeoInfo } from "../api";
import { releaseAllMedia } from "../lib/mediaTracks";

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "VideoMER/1.0" } }
    );
    const data = await res.json();
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

const GEO_PUBLISH_INTERVAL_MS = 30000;

function _avg(arr) {
  const nums = arr.filter((n) => typeof n === "number" && !Number.isNaN(n));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

// Summarise live in-call RTC stats for telemetry. VideoSDK 0.12.5 removed the
// pre-call getNetworkStats() speedtest; during a call the real signal is the
// participant's live stats. A participant's getAudioStats()/getVideoStats()
// each return an array of { bitrate(kbps), rtt, jitter, totalPackets, packetsLost }.
// Local participant = what we SEND (uplink); a remote participant = what we
// RECEIVE (downlink).
async function readStreamStats(participant) {
  if (!participant) return null;
  try {
    const [audio, video] = await Promise.all([
      participant.getAudioStats ? participant.getAudioStats() : [],
      participant.getVideoStats ? participant.getVideoStats() : [],
    ]);
    const all = [...(audio || []), ...(video || [])];
    if (!all.length) return null;
    const bitrateKbps = all.reduce((sum, s) => sum + (s.bitrate || 0), 0);
    const rtt = _avg(all.map((s) => s.rtt));
    const jitter = _avg(all.map((s) => s.jitter));
    const totalPackets = all.reduce((sum, s) => sum + (s.totalPackets || 0), 0);
    const packetsLost = all.reduce((sum, s) => sum + (s.packetsLost || 0), 0);
    return {
      mbps: Math.round((bitrateKbps / 1000) * 100) / 100,
      rtt: rtt == null ? null : Math.round(rtt),
      jitter: jitter == null ? null : Math.round(jitter),
      packetLossPct: totalPackets > 0 ? Math.round((packetsLost / totalPackets) * 1000) / 10 : null,
    };
  } catch {
    return null;
  }
}

// Every state the SDK's onMeetingStateChanged emits. "progress" states stay
// on screen until the connection resolves; the rest auto-dismiss.
const MEETING_STATE_TOAST = {
  CONNECTING:   { message: "Connecting to the consultation…", type: "info",    progress: true },
  RECONNECTING: { message: "Meeting is reconnecting…", type: "warning", progress: true },
  CONNECTED:    { message: "Meeting is connected", type: "success" },
  DISCONNECTED: { message: "Disconnected from the meeting", type: "error" },
  FAILED:       { message: "Meeting connection failed", type: "error" },
};
const MEETING_STATE_TOAST_ID = (state) => `meeting-state-${state}`;

export function MeetingContainer({ onMeetingLeave, precallTracks = { video: false, audio: false } }) {
  const bottomBarHeight = 60;

  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const {
    initialMicOn,
    initialWebcamOn,
    selectedWebcam,
    selectedMicrophone,
    setParticipantLeftReason,
    participantMode,
    caseId,
    setGeoData,
    isAudioOnly,
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

  // The pre-call tracks are handed to MeetingProvider as custom tracks and
  // published as-is — no re-creation on join (that used to open a second
  // camera/mic and briefly drop media). Only when a track wasn't provided
  // (e.g. rejoin from the Thank You page) do we create one, with the same config.
  async function onMeetingJoined() {
    try {
      const meeting = mMeetingRef.current;
      if (initialWebcamOn && !isAudioOnly && !precallTracks.video) {
        const track = await createVideoTrack(selectedWebcam?.id);
        if (track) meeting.changeWebcam(track);
      }
      if (initialMicOn && !precallTracks.audio) {
        const track = await createAudioTrack(selectedMicrophone?.id);
        if (track) meeting.changeMic(track);
      }
      // Let the SDK pause/downgrade incoming video by itself when the link
      // degrades, instead of every participant always pulling full quality.
      try {
        meeting.enableAdaptiveSubscription();
      } catch (e) {
        console.warn("enableAdaptiveSubscription failed:", e);
      }
    } catch (e) {
      console.warn("onMeetingJoined error:", e);
    } finally {
      setLocalParticipantAllowedJoin(true);
    }
  }

  async function onMeetingLeft() {
    // Release camera/mic: whatever the SDK is still publishing plus every track
    // we opened ourselves (preview, swapped-out).
    const published = [];
    mMeetingRef.current?.localParticipant?.streams?.forEach((st) => st?.track && published.push(st.track));
    await releaseAllMedia(published);
    onMeetingLeave();
  }

  const _handleOnError = (data) => {
    console.error("[VideoSDK] onError:", data);
    const { code, message } = data || {};
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

    console.log("[VideoSDK] onMeetingStateChanged:", state);
    setMeetingState(state);

    if (process.env.NODE_ENV !== "production") {
      // Which states actually fired, in order: window.__meetingStates
      window.__meetingStates = (window.__meetingStates || []).concat({ state, at: new Date().toISOString() });
    }

    const entry = MEETING_STATE_TOAST[state];
    if (!entry) return;

    // Only ever one meeting-state toast on screen: drop the others first, so a
    // flapping connection doesn't stack a pile of stale banners.
    Object.keys(MEETING_STATE_TOAST)
      .filter((other) => other !== state)
      .forEach((other) => toast.dismiss(MEETING_STATE_TOAST_ID(other)));

    toast(entry.message, {
      toastId: MEETING_STATE_TOAST_ID(state),
      position: "bottom-left",
      type: entry.type,
      // Type still drives the colour; just no leading glyph.
      icon: false,
      // Connecting / reconnecting have no natural end — they're cleared by
      // whichever state comes next.
      autoClose: entry.progress ? false : 4000,
      hideProgressBar: true,
      closeButton: false,
      pauseOnHover: true,
      draggable: true,
      theme: "dark",
    });
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

  // Transient connection-status message shown over the patient's video.
  const remoteParticipantCount = [...mMeeting.participants.keys()].filter(
    (id) =>
      id !== mMeeting.localParticipant?.id &&
      mMeeting.participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  ).length;
  const statusMessage =
    meetingState !== "CONNECTED"
      ? "Reconnecting…"
      : remoteParticipantCount === 0
      ? "Waiting for Other Participant…"
      : null;

  useEffect(() => {
    mMeetingRef.current = mMeeting;
  }, [mMeeting]);

  // Both watches stand down unless the meeting is actually connected. While
  // reconnecting the stats describe a half-torn-down transport, and both sides
  // reset to "unknown" so no stale verdict survives the outage.
  const isConnected = meetingState === "CONNECTED";

  // Uplink health from loss / rtt / jitter on our own outbound stats.
  const localNetwork = useNetworkWatch({
    participantId: mMeeting?.localParticipant?.id,
    enabled: !!localParticipantAllowedJoin && isConnected &&
      (mMeeting?.localMicOn || mMeeting?.localWebcamOn),
    direction: "uplink",
  });

  // Same check on the other party's inbound stream — what actually reaches us.
  const remoteParticipantId = [...mMeeting.participants.keys()].find(
    (id) =>
      id !== mMeeting.localParticipant?.id &&
      mMeeting.participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  );
  const remoteNetwork = useNetworkWatch({
    participantId: remoteParticipantId,
    enabled: !!localParticipantAllowedJoin && isConnected && !!remoteParticipantId,
    direction: "downlink",
  });

  // Banners: the SDK's own encoder limitation plus the low-uplink watch.
  const networkAlerts = [];
  if (qualityLimitation?.state === "detected") {
    const copy = {
      bandwidth: { title: "Limited bandwidth", body: "Video quality has been reduced to keep the call stable." },
      congestion: { title: "Network congestion", body: "Network traffic is affecting call quality." },
      cpu: { title: "Device under load", body: "Video quality has been reduced to keep the call stable." },
    }[qualityLimitation.type] || { title: "Connection quality reduced", body: "Call quality has been adjusted automatically." };
    networkAlerts.push({
      id: `limit-${qualityLimitation.type}`,
      tone: qualityLimitation.type === "cpu" ? "error" : "warn",
      icon: qualityLimitation.type === "cpu" ? "cpu" : "wifi",
      ...copy,
    });
  }
  if (localNetwork === "unstable") {
    networkAlerts.push({
      id: "local-unstable",
      tone: "error",
      icon: "wifi",
      title: "Unstable internet connection",
      body: "Your audio and video may be interrupted. Moving closer to your router or switching networks may help.",
    });
  } else if (localNetwork === "recovered") {
    networkAlerts.push({
      id: "local-recovered",
      tone: "ok",
      icon: "ok",
      title: "Connection restored",
      body: "Your internet connection is stable again.",
    });
  }
  // The other party — but only claimed on POSITIVE evidence that our own link
  // is clean ("ok", never "unknown"). Inbound stats travel over our last mile,
  // so a bad local connection degrades the incoming stream too and would
  // otherwise get blamed on them.
  const otherSide = isDoctor ? "Patient" : "Doctor";
  if (remoteNetwork === "unstable" && localNetwork === "ok") {
    networkAlerts.push({
      id: "remote-unstable",
      tone: "warn",
      icon: "wifi",
      title: `${otherSide} has an unstable connection`,
      body: `The ${otherSide.toLowerCase()}'s audio or video may be interrupted. You may experience delays or quality issues.`,
    });
  } else if (remoteNetwork === "recovered" && localNetwork === "ok") {
    networkAlerts.push({
      id: "remote-recovered",
      tone: "ok",
      icon: "ok",
      title: `${otherSide}'s connection restored`,
      body: `The ${otherSide.toLowerCase()}'s audio and video are stable again.`,
    });
  }



  const { publish: publishDeviceInfo } = usePubSub("DEVICE_INFO", {});

  useEffect(() => {
    if (!localParticipantAllowedJoin || !isCustomer) return;

    const collectAndPublish = async () => {
      // ── Phase 1: publish device/mic/camera info immediately (fast) ───────────
      let cameras = [], microphones = [], audioOutputs = [];
      let selectedCameraLabel = null, selectedMicLabel = null;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        // Audio-only calls don't report (or touch) cameras.
        const videoDevices  = isAudioOnly ? [] : devices.filter(d => d.kind === "videoinput");
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

      // ── Phase 2: enrich with live in-call network stats + geo (background) ──
      // 0.12.5 replacement for getNetworkStats(): read the participant RTC stats.
      // Wait a few seconds first so the RTP counters have accumulated.
      let downloadSpeed, uploadSpeed, latencyMs, packetLossPct, jitterMs;
      try {
        await new Promise((r) => setTimeout(r, 5000));
        const lp = mMeetingRef.current?.localParticipant;
        const remote = [...(mMeetingRef.current?.participants?.values() ?? [])]
          .find((p) => p?.id !== lp?.id);
        const [up, down] = await Promise.all([readStreamStats(lp), readStreamStats(remote)]);
        uploadSpeed   = up?.mbps ?? null;          // what the customer sends (uplink)
        downloadSpeed = down?.mbps ?? null;        // what the customer receives (downlink)
        latencyMs     = up?.rtt ?? down?.rtt ?? null;
        packetLossPct = up?.packetLossPct ?? null;
        jitterMs      = up?.jitter ?? null;
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
          latencyMs,
          packetLossPct,
          jitterMs,
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

    // GPS jitters constantly; each publish is a persisted message plus a
    // reverse-geocode request, so throttle hard on slow networks.
    if (lastGeoKeyRef.current === key || now - lastGeoPublishAtRef.current < GEO_PUBLISH_INTERVAL_MS) return;

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

  // "Leave site?" guard only while in the call — removed on unmount so the
  // Thank You page can be reloaded/closed without a prompt.
  useEffect(() => {
    const onBeforeUnload = (event) => {
      setParticipantLeftReason(meetingLeftReasons.TAB_BROWSER_CLOSED);
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
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
          const audioTrack = await createAudioTrack(selectedMicrophone?.id);
          if (audioTrack) meeting.changeMic(audioTrack);
        } catch (e) {
          console.warn("Mic restart after interruption failed:", e);
        }
      }

      if (meeting.localWebcamOn) {
        try {
          meeting.disableWebcam();
          await new Promise((r) => setTimeout(r, 300));
          const videoTrack = await createVideoTrack(selectedWebcam?.id);
          if (videoTrack) meeting.changeWebcam(videoTrack);
        } catch (e) {
          console.warn("Webcam restart after interruption failed:", e);
        }
      }
    };

    navigator.mediaDevices?.addEventListener("devicechange", restartAfterInterruption);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", restartAfterInterruption);
  }, [localParticipantAllowedJoin, isCustomer, selectedMicrophone, selectedWebcam, publishMicSilence]);

  return (
    <div className="fixed inset-0">
      <div ref={containerRef} className={`h-full w-full flex flex-col relative ${localParticipantAllowedJoin ? "bg-[#1b1b1e]" : "bg-transparent"}`}>
        {localParticipantAllowedJoin ? (
            <>
              <NetworkAlerts alerts={networkAlerts} />
              {/* Client side of the agent's capture button — no camera in audio calls */}
              {!isAudioOnly && <ImageUploadListner />}

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

                  <div className="relative flex flex-1 flex-row bg-[#1b1b1e] overflow-hidden">
                    <MemorizedParticipantView statusMessage={statusMessage} />
                    {showParticipantPanel && (
                      <div className="shrink-0 h-full">
                        <ParticipantDetailsPanel onClose={() => setShowParticipantPanel(false)} />
                      </div>
                    )}
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
