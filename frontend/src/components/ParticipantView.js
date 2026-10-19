import { useParticipant, VideoPlayer } from "@videosdk.live/react-sdk";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import useIsMobile from "../hooks/useIsMobile";
import useAudioLevel from "../hooks/useAudioLevel";
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

// Per-stream rows, ported from videosdk-rtc-react-sdk-example (CornerDisplayStats):
// values straight from getAudioStats()[0] / getVideoStats()[0]. On your own
// tile those describe what you SEND; on the other person's tile, what you
// RECEIVE from them.
function buildStatsRows(audioStats, videoStats, isLocal) {
  const a = audioStats?.[0];
  const v = videoStats?.[0];
  const ms = (x) => (x ? `${parseFloat(x).toFixed(2)} ms` : "-");
  const loss = (x) =>
    x?.packetsLost ? `${parseFloat((x.packetsLost * 100) / x.totalPackets).toFixed(2)}%` : "-";
  const kbps = (x) => (x?.bitrate ? `${parseFloat(x.bitrate).toFixed(2)} kb/s` : "-");
  const layers = (spatial, temporal) =>
    !isLocal && v && spatial != null ? `S:${spatial || 0} T:${temporal || 0}` : "-";
  return [
    { label: "Latency", audio: a?.rtt ? `${a.rtt} ms` : "-", video: v?.rtt ? `${v.rtt} ms` : "-" },
    { label: "Jitter", audio: ms(a?.jitter), video: ms(v?.jitter) },
    { label: "Packet Loss", audio: loss(a), video: loss(v) },
    { label: isLocal ? "Bitrate (you send)" : "Bitrate (you receive)", audio: kbps(a), video: kbps(v) },
    { label: "Frame rate", audio: "-", video: v?.size?.framerate == null ? "-" : `${v.size.framerate}` },
    { label: "Resolution", audio: "-", video: v?.size?.width == null ? "-" : `${v.size.width}x${v.size.height}` },
    { label: "Codec", audio: a?.codec || "-", video: v?.codec || "-" },
    { label: "Cur. Layers", audio: "-", video: layers(v?.currentSpatialLayer, v?.currentTemporalLayer) },
    { label: "Pref. Layers", audio: "-", video: layers(v?.preferredSpatialLayer, v?.preferredTemporalLayer) },
  ];
}

const GAP = 12;

// Stats modal, placed BESIDE the tile — never over the video. Right of the tile,
// or left when there's no room on the right; only on narrow phones (no room on
// either side) does it overlap, kept inside the viewport.
function StatsPanel({ title, rows, quality, tileRect, onClose, panelRef }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) setSize({ w: boxRef.current.offsetWidth, h: boxRef.current.offsetHeight });
  }, [rows.length]);

  const vw = window.innerWidth, vh = window.innerHeight;
  let left;
  if (tileRect.right + GAP + size.w <= vw - GAP) left = tileRect.right + GAP;
  else if (tileRect.left - GAP - size.w >= GAP) left = tileRect.left - GAP - size.w;
  else left = Math.max(GAP, vw - size.w - GAP);
  const top = Math.min(Math.max(GAP, tileRect.top), Math.max(GAP, vh - size.h - GAP));

  return ReactDOM.createPortal(
    <div
      ref={(el) => { boxRef.current = el; panelRef.current = el; }}
      className="fixed z-[999] w-[300px] bg-[#1b1b1e] rounded-lg shadow-lg border border-white/10 overflow-hidden"
      style={{ top, left, visibility: size.w ? "visible" : "hidden" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: quality.color }}>
        <div className="min-w-0">
          <p className="text-sm text-white font-semibold">Quality Score : {quality.label}</p>
          <p className="text-[11px] text-white/85 truncate">{title}</p>
        </div>
        <button onClick={onClose} aria-label="Close stats" className="text-white hover:bg-white/20 rounded-full px-1.5 leading-6 shrink-0">
          ×
        </button>
      </div>

      <div className="flex text-[11px] font-semibold text-white/70 border-b border-white/20">
        <span className="flex-1 px-2 py-1.5" />
        <span className="w-[85px] px-2 py-1.5 text-center">Audio</span>
        <span className="w-[85px] px-2 py-1.5 text-center">Video</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className={`flex text-xs ${i < rows.length - 1 ? "border-b border-white/20" : ""}`}>
          <span className="flex-1 px-2 py-1.5 text-white">{r.label}</span>
          <span className="w-[85px] px-2 py-1.5 text-center text-white tabular-nums border-l border-white/20">{r.audio}</span>
          <span className="w-[85px] px-2 py-1.5 text-center text-white tabular-nums border-l border-white/20">{r.video}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

const OPEN_POLL_MS = 500; // the example's cadence, only while the modal is open

// Network badge on every tile (doctor and patient): colour from the quality
// score of the main stream; click for the stats modal beside the tile.
function NetworkBadge({ participantId, isLocal, displayName }) {
  const { webcamStream, micStream, getVideoStats, getAudioStats } = useParticipant(participantId);
  const [quality, setQuality] = useState(QUALITY.good);
  const [open, setOpen] = useState(false);
  const [tileRect, setTileRect] = useState(null);
  const [stats, setStats] = useState({ audio: [], video: [] });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!webcamStream && !micStream) return;
    let cancelled = false;
    const update = async () => {
      try {
        const main = webcamStream ? await getVideoStats() : await getAudioStats();
        if (cancelled) return;
        setQuality(main?.length ? qualityFromScore(getQualityScore(main[0])) : QUALITY.good);
        if (open) {
          const [video, audio] = await Promise.all([getVideoStats(), getAudioStats()]);
          if (!cancelled) setStats({ video: video || [], audio: audio || [] });
        }
      } catch (e) { /* stats unavailable — keep last value */ }
    };
    update();
    const id = setInterval(update, open ? OPEN_POLL_MS : STATS_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamStream, micStream, open]);

  // Close on any click outside the badge / modal; follow the tile on resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => {
      const tile = btnRef.current?.closest("[data-participant-tile]");
      if (tile) setTileRect(tile.getBoundingClientRect());
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  if (!webcamStream && !micStream) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const tile = e.currentTarget.closest("[data-participant-tile]") || e.currentTarget;
          setTileRect(tile.getBoundingClientRect());
          setOpen((o) => !o);
        }}
        className="absolute top-2 right-2 z-20 rounded-full flex items-center justify-center p-1.5 cursor-pointer ring-1 ring-white/30 hover:ring-white/70 transition"
        style={{ backgroundColor: quality.color }}
        title={`Network: ${quality.label} — click for stats`}
        aria-label={`Network quality ${quality.label}. Show network stats`}
        aria-expanded={open}
      >
        <NetworkIcon color1="#fff" color2="#fff" color3="#fff" color4="#fff" style={{ height: 10, width: 10 }} />
      </button>
      {open && tileRect && (
        <StatsPanel
          title={isLocal ? "You" : nameTructed(displayName, 24)}
          rows={buildStatsRows(stats.audio, stats.video, isLocal)}
          quality={quality}
          tileRect={tileRect}
          panelRef={panelRef}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

const SPEAKING = "#3BA55D";

// Speaking badge (bottom-right): five bars that bounce while the person talks,
// taller the louder they are (level 0..4); small grey dots when silent.
const BAR_SHAPE = [0.55, 0.85, 1, 0.85, 0.55];
function AudioBadge({ level }) {
  const speaking = level > 0;
  return (
    <div
      className="absolute bottom-2 right-2 z-10 flex items-center justify-center gap-[3px] h-8 w-8 rounded-full backdrop-blur-sm"
      style={{
        backgroundColor: speaking ? SPEAKING : "#00000080",
        boxShadow: speaking ? `0 0 0 ${level * 2}px ${SPEAKING}40` : "none",
        transition: "background-color 0.15s ease, box-shadow 0.12s ease-out",
      }}
      aria-label={speaking ? "Speaking" : "Not speaking"}
    >
      {BAR_SHAPE.map((k, i) => (
        <span
          key={i}
          className={`w-[3px] h-4 rounded-full bg-white ${speaking ? "audio-bar" : ""}`}
          style={{
            "--peak": Math.max(0.35, (0.4 + 0.15 * level) * k),
            animationDelay: `${i * 90}ms`,
            transform: speaking ? undefined : "scaleY(0.2)",
            opacity: speaking ? 1 : 0.6,
          }}
        />
      ))}
    </div>
  );
}

function NameTag({ displayName, isLocal, micOn, isPip }) {
  return (
    <div
      className={`absolute bottom-2 left-2 rounded-full flex items-center justify-center backdrop-blur-sm ${isPip ? "px-2 py-0.5" : "px-2.5 py-1"}`}
      style={{ backgroundColor: "#00000080" }}
    >
      {!micOn && (
        <div className="flex items-center justify-center rounded-full mr-1.5 p-0.5" style={{ backgroundColor: "#D32F2Fcc" }}>
          <MicOffSmallIcon fillcolor="white" />
        </div>
      )}
      <p className="text-xs text-white font-medium">{isLocal ? "You" : nameTructed(displayName, 26)}</p>
    </div>
  );
}

function ParticipantView({ participantId, isPip, forceContain = false }) {
  // Adaptive subscriptions pause incoming video when the link is tight or the
  // participant isn't the dominant speaker; tell the viewer instead of just
  // freezing the tile. ("muted" means they turned their camera/mic off, which
  // the avatar already covers.)
  const [pausedReason, setPausedReason] = useState(null);
  const { displayName, micStream, webcamOn, micOn, isLocal, mode } = useParticipant(participantId, {
    onStreamPaused: ({ kind, reason }) => {
      if (kind === "video" && reason !== "muted") setPausedReason(reason);
    },
    onStreamResumed: ({ kind }) => {
      if (kind === "video") setPausedReason(null);
    },
  });

  const isMobile = useIsMobile();
  const { isDoctor, maintainLandscapeVideoAspectRatio, muteSpeaker, selectedSpeaker, incomingVideoPaused } =
    useMeetingAppContext((s) => ({
      isDoctor: s.isDoctor,
      maintainLandscapeVideoAspectRatio: s.maintainLandscapeVideoAspectRatio,
      muteSpeaker: s.muteSpeaker,
      selectedSpeaker: s.selectedSpeaker,
      incomingVideoPaused: s.incomingVideoPaused,
    }));

  const [zoom, setZoom] = useState(1);
  const showZoom = isDoctor && !isLocal && webcamOn;

  const micRef = useRef(null);
  const level = useAudioLevel(micOn ? micStream?.track : null);
  const speaking = level > 0;

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

  // A paused consumer keeps webcamOn true and simply stops delivering frames,
  // so the <video> would sit on its last decoded one. Our own pause flag is the
  // authoritative source here — onStreamPaused is only a secondary signal (it
  // covers the SDK's adaptive pauses, and may not fire for a pause we asked
  // for ourselves). Remote tiles only: our own camera is unaffected.
  const videoPaused = pausedReason || (incomingVideoPaused && !isLocal);

  const fit = forceContain || (!isMobile && maintainLandscapeVideoAspectRatio) ? "video-contain" : "video-cover";

  return (
    <div data-participant-tile className={`h-full w-full bg-gray-750 relative overflow-hidden rounded-lg ${fit}`}>
      <audio ref={micRef} autoPlay muted={isLocal || !muteSpeaker} />
      {webcamOn && !videoPaused ? (
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
          <div
            className="relative z-10 flex items-center justify-center rounded-full bg-gray-800 2xl:h-[92px] h-[52px] 2xl:w-[92px] w-[52px]"
            style={{
              boxShadow: speaking ? `0 0 0 3px ${SPEAKING}` : "none",
              transition: "box-shadow 0.12s ease-out",
            }}
          >
            {/* Ripple rings while speaking */}
            {speaking && (
              <>
                <span className="audio-ripple" style={{ borderColor: SPEAKING }} />
                <span className="audio-ripple" style={{ borderColor: SPEAKING, animationDelay: "0.6s" }} />
              </>
            )}
            <p className="text-2xl text-white">{String(displayName).charAt(0).toUpperCase()}</p>
          </div>
        </div>
      )}

      {showZoom && (
        <div className="absolute z-10 top-2 left-2 flex items-center rounded-full bg-black/50 backdrop-blur-sm overflow-hidden">
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
              className={`inline-flex items-center justify-center h-6 px-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-40 ${key === "reset" ? "min-w-[40px] tabular-nums" : "w-6"}`}
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

      {videoPaused && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-gray-750 px-4">
          <div className="flex items-center justify-center rounded-full bg-gray-800 2xl:h-[92px] h-[52px] 2xl:w-[92px] w-[52px]">
            <p className="text-2xl text-white">{String(displayName).charAt(0).toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[rgba(27,27,30,0.92)] border border-white/10 px-3 py-2 max-w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF900C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <circle cx="12" cy="20" r="1" fill="#FF900C" stroke="none" />
            </svg>
            <p className={`text-white ${isPip ? "text-[10px]" : "text-xs"} leading-4`}>
              Video paused to save bandwidth
            </p>
          </div>
        </div>
      )}

      {/* Speaking outline — drawn above the video so it is never cropped */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          // Solid edge + inner glow that grows with loudness.
          boxShadow: speaking
            ? `inset 0 0 0 3px ${SPEAKING}, inset 0 0 ${12 + level * 6}px ${SPEAKING}80`
            : "inset 0 0 0 0 transparent",
          transition: "box-shadow 0.12s ease-out",
        }}
      />

      <NetworkBadge participantId={participantId} isLocal={isLocal} displayName={displayName} />
      <NameTag displayName={displayName} isLocal={isLocal} micOn={micOn} isPip={isPip} />
      {micOn && <AudioBadge level={level} />}
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
