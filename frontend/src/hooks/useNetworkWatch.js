import { useEffect, useRef, useState } from "react";
import { useParticipant } from "@videosdk.live/react-sdk";
import useParticipantStats from "./useParticipantStats";

// Any one of these means the link is bad. loss is a fraction; rtt/jitter ms;
// bitrate kbps. Calibrated off the SDK's own penalty curves, which give zero
// penalty below 200ms rtt / 25ms jitter and flag "high jitter" at 70ms.
const BAD = {
  loss: 0.08,
  rtt: 500,
  jitter: 80,
  videoKbps: 15,      // video only — Opus DTX drops to a few kbps in silence
  frozenFraction: 0.08,  // downlink only
  droppedRatio: 0.06,    // downlink only
};

const BAD_SAMPLES = 3;        // ~6s to warn
const GOOD_SAMPLES = 5;       // ~10s to clear
const RECOVERED_MS = 5000;
const MIN_PACKETS_FOR_LOSS = 20;
const MIN_FRAMES_FOR_DROP_RATIO = 20;
const GRACE_MS = 8000;        // encoder ramp-up is noisy

// Simulcast senders report one entry per layer: packets/bitrate/frames add up,
// jitter and rtt are worst-case, freeze counters are cumulative so take the max.
function foldEntries(entries) {
  const out = {
    packetsLost: 0, totalPackets: 0, bitrate: 0,
    jitter: null, rtt: null,
    freezeSec: null, framesDropped: null, framesReceived: null,
  };
  for (const e of entries) {
    if (e.packetsLost != null) out.packetsLost += e.packetsLost;
    if (e.totalPackets != null) out.totalPackets += e.totalPackets;
    if (e.bitrate != null) out.bitrate += e.bitrate;
    if (e.jitter != null) out.jitter = Math.max(out.jitter ?? 0, e.jitter);
    const rtt = e.rtt ?? e.roundTripTime;  // typings disagree on the name
    if (rtt != null) out.rtt = Math.max(out.rtt ?? 0, rtt);
    if (e.totalFreezesDuration != null) out.freezeSec = Math.max(out.freezeSec ?? 0, e.totalFreezesDuration);
    if (e.framesDropped != null) out.framesDropped = Math.max(out.framesDropped ?? 0, e.framesDropped);
    if (e.framesReceived != null) out.framesReceived = Math.max(out.framesReceived ?? 0, e.framesReceived);
  }
  return out;
}

// status: "unknown" | "ok" | "unstable" | "recovered"
// "unknown" means NOT MEASURED — it is deliberately distinct from "ok", so a
// watcher that merely stopped reporting is never read as a healthy link.
// direction "uplink" = local participant, "downlink" = a remote one.
export default function useNetworkWatch({ participantId, enabled = true, direction = "uplink" }) {
  const { getVideoStats, getAudioStats } = useParticipant(participantId);
  const snapshot = useParticipantStats(participantId, getVideoStats, getAudioStats, enabled);
  const [status, setStatus] = useState("unknown");

  const badRef = useRef(0);
  const goodRef = useRef(0);
  const unstableRef = useRef(false);
  const inRecoveredRef = useRef(false);
  const recoveredTimerRef = useRef(null);
  const prevRef = useRef(null);
  const startedAtRef = useRef(0);

  // Reset whenever we stop (or start) watching something.
  useEffect(() => {
    badRef.current = 0;
    goodRef.current = 0;
    unstableRef.current = false;
    inRecoveredRef.current = false;
    prevRef.current = null;
    startedAtRef.current = Date.now();
    clearTimeout(recoveredTimerRef.current);
    setStatus("unknown");
  }, [participantId, enabled, direction]);

  useEffect(() => () => clearTimeout(recoveredTimerRef.current), []);

  useEffect(() => {
    if (!enabled || !participantId || !snapshot?.entries?.length) return;

    const isDownlink = direction === "downlink";
    const s = foldEntries(snapshot.entries);
    const prev = prevRef.current;
    const elapsedMs = prev ? snapshot.at - prev.at : null;
    const delta = (now, before) =>
      prev && now != null && before != null ? Math.max(0, now - before) : null;
    const deltaFreezeSec = delta(s.freezeSec, prev?.freezeSec);
    const deltaDropped = delta(s.framesDropped, prev?.framesDropped);
    const deltaReceived = delta(s.framesReceived, prev?.framesReceived);
    prevRef.current = {
      at: snapshot.at, freezeSec: s.freezeSec,
      framesDropped: s.framesDropped, framesReceived: s.framesReceived,
    };
    if (snapshot.at - startedAtRef.current < GRACE_MS) return;

    // Outbound totalPackets counts packets SENT (lost ones included); inbound
    // counts packets that ARRIVED, so lost ones must be added back.
    const lost = Math.max(0, s.packetsLost);
    const expected = isDownlink ? s.totalPackets + lost : s.totalPackets;

    // A signal is only consulted when measurable, so a missing one reads as fine.
    const lossBad = expected >= MIN_PACKETS_FOR_LOSS && lost / expected > BAD.loss;
    // rtt is OUR transport RTT, identical for every participant — blaming a
    // remote party for it would mis-attribute our own slow path.
    const rttBad = !isDownlink && s.rtt != null && s.rtt > BAD.rtt;
    const jitterBad = s.jitter != null && s.jitter > BAD.jitter;
    // Too few packets for a loss ratio to fire, so this catches a dead uplink.
    const bitrateBad = snapshot.isVideo && s.bitrate > 0 && s.bitrate < BAD.videoKbps;
    // The only inbound signals that reveal trouble beyond the media server.
    const frozenBad = isDownlink && deltaFreezeSec != null && elapsedMs > 0 &&
      deltaFreezeSec / (elapsedMs / 1000) > BAD.frozenFraction;
    const droppedBad = isDownlink && deltaDropped != null &&
      deltaReceived >= MIN_FRAMES_FOR_DROP_RATIO && deltaDropped / deltaReceived > BAD.droppedRatio;

    const isBad = lossBad || rttBad || jitterBad || bitrateBad || frozenBad || droppedBad;

    badRef.current = isBad ? badRef.current + 1 : 0;
    goodRef.current = isBad ? 0 : goodRef.current + 1;

    if (!unstableRef.current && badRef.current >= BAD_SAMPLES) {
      unstableRef.current = true;
      inRecoveredRef.current = false;
      clearTimeout(recoveredTimerRef.current);
      setStatus("unstable");
    } else if (unstableRef.current && goodRef.current >= GOOD_SAMPLES) {
      unstableRef.current = false;
      inRecoveredRef.current = true;
      setStatus("recovered");
      recoveredTimerRef.current = setTimeout(() => {
        inRecoveredRef.current = false;
        setStatus("ok");
      }, RECOVERED_MS);
    } else if (!unstableRef.current && !inRecoveredRef.current && goodRef.current >= GOOD_SAMPLES) {
      // "ok" is earned the same way a warning is: a confirmed clean run.
      setStatus("ok");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  return status;
}
