import { useParticipant, VideoPlayer } from "@videosdk.live/react-sdk";
import React, { useEffect, useRef, useState } from "react";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import useIsMobile from "../hooks/useIsMobile";
import MicOffSmallIcon from "../icons/MicOffSmallIcon";
import NetworkIcon from "../icons/NetworkIcon";
import { getQualityScore, nameTructed } from "../utils/common";

// Agent-side visual zoom on the client's video (CSS scale on the <video>;
// nothing is re-encoded or re-requested, so it costs no bandwidth).
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const clampZoom = (v) =>
  Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v)) * 100) / 100;

// VideoPlayer mirrors the local camera (scaleX(-1) on the <video>, which wins
// over videoStyle). Flip the container back so the self-view shows exactly the
// frame being sent — same as the pre-call preview and what the other side sees
// (e.g. the Apollo background logo reads correctly).
export const UNMIRROR = { transform: "scaleX(-1)" };

// 2 s is plenty for a quality badge; getStats() is not free on low-end phones.
const STATS_POLL_MS = 2000;

const QUALITY = {
  good: { color: "#3BA55D", label: "Good" },
  average: { color: "#faa713", label: "Average" },
  poor: { color: "#FF5D5D", label: "Poor" },
};

function qualityFromScore(score) {
  if (score > 7) return QUALITY.good;
  if (score > 4) return QUALITY.average;
  return QUALITY.poor;
}

// Network badge: colour only (green / orange / red) from packet loss, jitter
// and RTT of the participant's active stream. Not clickable.
function NetworkBadge({ participantId, isPip }) {
  const { webcamStream, micStream, getVideoStats, getAudioStats } = useParticipant(participantId);
  const [quality, setQuality] = useState(QUALITY.good);

  useEffect(() => {
    if (!webcamStream && !micStream) return;
    let cancelled = false;
    const update = async () => {
      try {
        const stats = webcamStream ? await getVideoStats() : await getAudioStats();
        if (!cancelled && stats?.length) setQuality(qualityFromScore(getQualityScore(stats[0])));
      } catch (e) { /* stats unavailable — keep last value */ }
    };
    update();
    const id = setInterval(update, STATS_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamStream, micStream]);

  if (!webcamStream && !micStream) return null;

  const size = isPip ? 10 : 12;
  return (
    <div
      className={`absolute top-1 right-1 md:top-3 md:right-3 rounded-md flex items-center justify-center ${isPip ? "p-1" : "p-1.5"}`}
      style={{ backgroundColor: quality.color }}
      title={`Network: ${quality.label}`}
      aria-label={`Network quality ${quality.label}`}
    >
      <NetworkIcon color1="#fff" color2="#fff" color3="#fff" color4="#fff" style={{ height: size, width: size }} />
    </div>
  );
}

function NameTag({ displayName, isLocal, micOn, isPip }) {
  return (
    <div
      className={`absolute bottom-2 left-2 rounded-md flex items-center justify-center ${isPip ? "p-1" : "p-2"}`}
      style={{ backgroundColor: "#00000066" }}
    >
      {!micOn && (
        <div className="flex items-center justify-center rounded-full mr-1.5 p-0.5" style={{ backgroundColor: "#D32F2Fcc" }}>
          <MicOffSmallIcon fillcolor="white" />
        </div>
      )}
      <p className="text-sm text-white">{isLocal ? "You" : nameTructed(displayName, 26)}</p>
    </div>
  );
}

function ParticipantView({ participantId, isPip, forceContain = false }) {
  const { displayName, micStream, webcamOn, micOn, isLocal, mode } = useParticipant(participantId);

  const isMobile = useIsMobile();
  const { isDoctor, maintainLandscapeVideoAspectRatio, muteSpeaker, selectedSpeaker } =
    useMeetingAppContext((s) => ({
      isDoctor: s.isDoctor,
      maintainLandscapeVideoAspectRatio: s.maintainLandscapeVideoAspectRatio,
      muteSpeaker: s.muteSpeaker,
      selectedSpeaker: s.selectedSpeaker,
    }));

  const [zoom, setZoom] = useState(1);
  const showZoom = isDoctor && !isLocal && webcamOn;

  const micRef = useRef(null);

  useEffect(() => {
    const el = micRef.current;
    if (!el) return;
    if (!(micOn && micStream)) {
      el.srcObject = null;
      return;
    }
    el.srcObject = new MediaStream([micStream.track]);
    el.play().catch((error) => console.error("audioElem.current.play() failed", error));

    // Defer setSinkId so it isn't rejected for lacking a user gesture.
    if (!selectedSpeaker?.id || typeof el.setSinkId !== "function") return;
    const timeoutId = setTimeout(() => {
      el.setSinkId(selectedSpeaker.id).catch((error) => console.warn("Error setting audio output device:", error));
    }, 100);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micStream, micOn]);

  if (mode !== "SEND_AND_RECV") return null;

  const fit = forceContain || (!isMobile && maintainLandscapeVideoAspectRatio) ? "video-contain" : "video-cover";

  return (
    <div className={`h-full w-full bg-gray-750 relative overflow-hidden rounded-lg ${fit}`}>
      <audio ref={micRef} autoPlay muted={isLocal || !muteSpeaker} />
      {webcamOn ? (
        <VideoPlayer
          participantId={participantId}
          type="video"
          containerStyle={{ height: "100%", width: "100%", ...(isLocal ? UNMIRROR : null) }}
          className="h-full"
          classNameVideo="h-full"
          videoStyle={{
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            transition: "transform 0.15s ease",
          }}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <div className="z-10 flex items-center justify-center rounded-full bg-gray-800 2xl:h-[92px] h-[52px] 2xl:w-[92px] w-[52px]">
            <p className="text-2xl text-white">{String(displayName).charAt(0).toUpperCase()}</p>
          </div>
        </div>
      )}

      {showZoom && (
        <div className={`absolute z-10 flex gap-1 ${isPip ? "top-1 left-1" : "top-1 md:top-3 left-2 md:left-3"}`}>
          {[
            { key: "out", label: "−", title: "Zoom out", disabled: zoom <= ZOOM_MIN, onClick: () => setZoom((z) => clampZoom(z - ZOOM_STEP)) },
            { key: "reset", label: `${zoom}x`, title: "Reset zoom", disabled: zoom === 1, onClick: () => setZoom(1) },
            { key: "in", label: "+", title: "Zoom in", disabled: zoom >= ZOOM_MAX, onClick: () => setZoom((z) => clampZoom(z + ZOOM_STEP)) },
          ].map(({ key, label, title, disabled, onClick }) => (
            <button
              key={key}
              title={title}
              aria-label={title}
              disabled={disabled}
              className={`inline-flex items-center justify-center ${isPip ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"} ${key === "reset" ? "min-w-[52px]" : ""} border border-gray-100 font-medium rounded-sm text-white bg-gray-750 disabled:opacity-50`}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <NetworkBadge participantId={participantId} isPip={isPip} />
      <NameTag displayName={displayName} isLocal={isLocal} micOn={micOn} isPip={isPip} />
    </div>
  );
}

export const MemoizedParticipant = React.memo(
  ParticipantView,
  (prevProps, nextProps) =>
    prevProps.participantId === nextProps.participantId &&
    prevProps.isPip === nextProps.isPip &&
    prevProps.forceContain === nextProps.forceContain
);
