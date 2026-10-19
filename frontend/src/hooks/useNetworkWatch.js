import { useEffect, useRef, useState } from "react";
import { useParticipant } from "@videosdk.live/react-sdk";

// Any one of these is enough to call a link bad.
// loss is a fraction (0-1); rtt and jitter are ms; bitrate is kbps.
//
// Calibrated against the SDK's own penalty curves (js-sdk: rttPenalty,
// videoJitterPenalty, videoLossPenalty), which are tuned to ITU-T G.107/G.114.
// Those curves assign ZERO penalty below 200ms rtt and 25ms jitter, and the
// SDK's own "high jitter" flag is 70ms — so anything near those deadbands is
// normal traffic, not a problem worth interrupting a consultation for.
//
//   loss  8%    → SDK penalty 45 → FAIR
//   rtt   500ms → SDK penalty 33 → GOOD/FAIR boundary
//   jitter 80ms → SDK penalty 28 → past the SDK's own 70ms "high" flag
const BAD = {
  loss: 0.08,
  rtt: 500,
  jitter: 80,
  // A video stream this thin is effectively not getting through. Checked only
  // on video samples — Opus with DTX legitimately drops to a few kbps in
  // silence, so this floor would false-fire on the audio fallback.
  videoKbps: 15,
  // Downlink only, straight from the SDK's own constants: fraction of the
  // interval the picture was frozen, and share of frames the decoder threw away.
  frozenFraction: 0.08,
  droppedRatio: 0.06,
};

const POLL_MS = 2000;
// Asymmetric on purpose: ~6 s of bad samples to warn, ~10 s of clean ones to
// clear. One bad poll shouldn't raise the banner, and one good poll in the
// middle of a bad patch shouldn't drop it.
const BAD_SAMPLES = 3;
const GOOD_SAMPLES = 5;
// How long the "connection restored" confirmation stays up.
const RECOVERED_MS = 5000;
// Below this many packets in an interval the loss ratio is meaningless — a
// single lost packet out of 3 reads as 33%. Same guard the SDK uses
// (MIN_PACKETS_FOR_LOSS) before it will compute a loss percentage at all.
const MIN_PACKETS_FOR_LOSS = 20;
// Likewise for the dropped-frame ratio over a single 2 s interval.
const MIN_FRAMES_FOR_DROP_RATIO = 20;
// The encoder ramps up and the first RTCP reports are noisy; the SDK skips
// this window too (its `inRampUp`).
const GRACE_MS = 8000;

// Collapse all stats entries into one view. A simulcast sender (the doctor
// runs multiStream) reports one entry per layer, so reading entries[0] alone
// would judge the link on an arbitrary layer. Packets, bitrate and frame
// counts add up across layers; jitter and rtt are worst-case. The freeze
// counters are cumulative per stream, so take the highest.
function foldEntries(entries) {
  const out = {
    packetsLost: 0, totalPackets: 0, bitrate: 0,
    jitter: null, rtt: null,
    freezeSec: null, framesDropped: null, framesReceived: null,
    // One per simulcast layer — what Chrome's encoder is reporting right now.
    limitationReasons: [],
  };
  for (const e of entries) {
    if (e.packetsLost != null) out.packetsLost += e.packetsLost;
    if (e.totalPackets != null) out.totalPackets += e.totalPackets;
    if (e.bitrate != null) out.bitrate += e.bitrate;
    if (e.jitter != null) out.jitter = Math.max(out.jitter ?? 0, e.jitter);
    // Runtime field is `rtt` (transport RTT, ms); some SDK typings call it
    // roundTripTime. Read both so the check can't silently go dead.
    const entryRtt = e.rtt ?? e.roundTripTime;
    if (entryRtt != null) out.rtt = Math.max(out.rtt ?? 0, entryRtt);
    out.limitationReasons.push(e.limitation?.reason ?? null);
    if (e.totalFreezesDuration != null) out.freezeSec = Math.max(out.freezeSec ?? 0, e.totalFreezesDuration);
    if (e.framesDropped != null) out.framesDropped = Math.max(out.framesDropped ?? 0, e.framesDropped);
    if (e.framesReceived != null) out.framesReceived = Math.max(out.framesReceived ?? 0, e.framesReceived);
  }
  return out;
}

// Watches one participant's stats and reports whether their link is healthy.
//   status: "unknown" | "ok" | "unstable" | "recovered"
// "unknown" means NOT MEASURED — before the first confirmed samples, and
// whenever the watch is disabled (reconnecting, devices off, no participant).
// It is deliberately distinct from "ok": callers that need to know the link is
// genuinely healthy (e.g. before blaming the other side) must test for "ok",
// so a watch that simply stopped reporting is never mistaken for a clean link.
// "recovered" is a short-lived state after a bad patch clears, so the UI can
// confirm things are fine again instead of the warning just vanishing.
//
// direction "uplink"   → the LOCAL participant: what this device manages to send.
// direction "downlink" → a REMOTE participant: what actually reaches us.
// (There is no useRemoteParticipant in the SDK — useParticipant serves both;
// what changes is which way the stats point, hence the differences below.)
export default function useNetworkWatch({ participantId, enabled = true, direction = "uplink" }) {
  const { getVideoStats, getAudioStats } = useParticipant(participantId);
  const [status, setStatus] = useState("unknown");

  const badRef = useRef(0);
  const goodRef = useRef(0);
  const unstableRef = useRef(false);
  const recoveredTimerRef = useRef(null);
  // True while the "connection restored" confirmation is still showing, so the
  // per-sample promotion below doesn't cut it short.
  const inRecoveredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !participantId) {
      // Reset to "unknown", never "ok" — we are not measuring, which is not
      // the same as a healthy link.
      badRef.current = 0;
      goodRef.current = 0;
      unstableRef.current = false;
      inRecoveredRef.current = false;
      clearTimeout(recoveredTimerRef.current);
      setStatus("unknown");
      return;
    }

    const isDownlink = direction === "downlink";
    let cancelled = false;
    const startedAt = Date.now();
    // Freeze / frame counters are cumulative, so we need the previous reading
    // to turn them into "what happened during this interval".
    let prev = null;

    const poll = async () => {
      let entries = [];
      let isVideo = true;
      try {
        // Video first — it's the bigger stream and degrades first. Only fall
        // back to audio stats when there's no camera, so we aren't running two
        // getStats() passes every tick on a low-end phone.
        entries = (await getVideoStats()) ?? [];
        if (!entries.length) {
          entries = (await getAudioStats()) ?? [];
          isVideo = false;
        }
      } catch (e) {
        return; // transient — keep the current verdict
      }
      if (cancelled || !entries.length) return;

      const s = foldEntries(entries);
      const elapsedMs = prev ? Date.now() - prev.at : null;
      const deltaFreezeSec = prev && s.freezeSec != null && prev.freezeSec != null
        ? Math.max(0, s.freezeSec - prev.freezeSec) : null;
      const deltaDropped = prev && s.framesDropped != null && prev.framesDropped != null
        ? Math.max(0, s.framesDropped - prev.framesDropped) : null;
      const deltaReceived = prev && s.framesReceived != null && prev.framesReceived != null
        ? Math.max(0, s.framesReceived - prev.framesReceived) : null;
      prev = { at: Date.now(), freezeSec: s.freezeSec, framesDropped: s.framesDropped, framesReceived: s.framesReceived };

      if (Date.now() - startedAt < GRACE_MS) return;

      // Direction-aware denominator, matching the SDK's computeLossPercent:
      // outbound totalPackets counts packets SENT (lost ones are included),
      // inbound counts packets that ARRIVED (lost ones never did, so they
      // have to be added back in).
      const lost = Math.max(0, s.packetsLost);
      const expected = isDownlink ? s.totalPackets + lost : s.totalPackets;

      // Each signal is only consulted when it's actually measurable, so a
      // missing one reads as "fine" rather than tripping the banner.
      const lossBad = expected >= MIN_PACKETS_FOR_LOSS && lost / expected > BAD.loss;
      // rtt here is the transport RTT of OUR OWN connection to the media
      // server (delta_rtt_connectivity_ms) — the same number for every
      // participant. It says nothing specific about a remote party's link, so
      // blaming them for it would mis-attribute our own slow path.
      const rttBad = !isDownlink && s.rtt != null && s.rtt > BAD.rtt;
      const jitterBad = s.jitter != null && s.jitter > BAD.jitter;
      // A near-dead stream carries too few packets for the loss ratio to fire,
      // so the bitrate floor is what actually catches "nothing is getting out".
      const bitrateBad = isVideo && s.bitrate > 0 && s.bitrate < BAD.videoKbps;
      // Freezes and dropped frames are the only inbound signals that reveal
      // trouble on the far side of the media server (see note in the header).
      const frozenBad = isDownlink && deltaFreezeSec != null && elapsedMs > 0 &&
        deltaFreezeSec / (elapsedMs / 1000) > BAD.frozenFraction;
      const droppedBad = isDownlink && deltaDropped != null && deltaReceived >= MIN_FRAMES_FOR_DROP_RATIO &&
        deltaDropped / deltaReceived > BAD.droppedRatio;

      const isBad = lossBad || rttBad || jitterBad || bitrateBad || frozenBad || droppedBad;

      if (process.env.NODE_ENV !== "production") {
        // Live numbers for tuning: window.__netWatch in the console.
        window.__netWatch = window.__netWatch || {};
        window.__netWatch[direction] = {
          lossPct: expected ? +((lost / expected) * 100).toFixed(2) : null,
          expected, jitter: s.jitter, rtt: s.rtt, kbps: Math.round(s.bitrate), isVideo,
          // One entry per encoding: 3 for a simulcast sender, 1 otherwise.
          layers: entries.length,
          limitationReasons: s.limitationReasons,
          frozen: deltaFreezeSec != null && elapsedMs ? +(deltaFreezeSec / (elapsedMs / 1000)).toFixed(3) : null,
          dropped: deltaReceived ? +(deltaDropped / deltaReceived).toFixed(3) : null,
          flags: { lossBad, rttBad, jitterBad, bitrateBad, frozenBad, droppedBad },
          bad: badRef.current, good: goodRef.current,
          status: unstableRef.current ? "unstable" : "ok",
        };
      }

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
          if (cancelled) return;
          inRecoveredRef.current = false;
          setStatus("ok");
        }, RECOVERED_MS);
      } else if (!unstableRef.current && !inRecoveredRef.current && goodRef.current >= GOOD_SAMPLES) {
        // Earn "ok" the same way a warning is earned: only after a confirmed
        // run of clean samples. This is what lifts the initial "unknown".
        setStatus("ok");
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(recoveredTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, enabled, direction]);

  return status;
}
