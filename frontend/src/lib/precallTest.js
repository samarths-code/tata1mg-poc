// precallTest.js — VideoSDK 0.12.5 pre-call network check.
//
// `getNetworkStats()` was REMOVED from @videosdk.live/react-sdk in the 0.12.x
// line. Its replacement, `runPreCallTest()`, is a different kind of measurement:
//
//   • It needs a `token` (it spins up a short, real test connection).
//   • It reports media-call QUALITY, not a raw speedtest. The resolved shape is
//       { aborted, testDuration, camera, microphone, networkQuality }
//     where `networkQuality` (the TS types mislabel this key `network`) is
//       { audioOnly, uplink, downlink }
//     and each direction is
//       { quality /* 0–10 */, factors, audio:{bitrate(kbps),rtt,jitter,packetLoss,…}, video:{…} }
//
// So there is no `downloadSpeed`/`uploadSpeed` in Mbps any more — the honest
// signal is the 0–10 quality score, which we map to a label below.
//
// This helper is for the PRE-CALL screens only (JoiningScreen / PermissionSetup).
// For in-call quality use the local participant's getAudioStats()/getVideoStats()
// instead — see meeting/MeetingContainer.js.
import { runPreCallTest } from "@videosdk.live/react-sdk";
import { getToken } from "../api";

// Same thresholds the SDK itself uses internally (scoreToRating).
const RATINGS = {
  excellent: { label: "Excellent", color: "text-green-400" },
  good:      { label: "Good",      color: "text-green-400" },
  fair:      { label: "Fair",      color: "text-yellow-300" },
  poor:      { label: "Poor",      color: "text-red-400" },
  bad:       { label: "Bad",       color: "text-red-400" },
  unknown:   { label: "Unknown",   color: "text-white/70" },
};

function ratingFromScore(score) {
  if (score == null || Number.isNaN(score)) return "unknown";
  if (score >= 8) return "excellent";
  if (score >= 6) return "good";
  if (score >= 4) return "fair";
  if (score >= 2) return "poor";
  return "bad";
}

function round(n) {
  return n == null || Number.isNaN(n) ? null : Math.round(n);
}

/**
 * Run the SDK pre-call test and normalise it into a flat, UI-friendly object.
 *
 * @param {object}  opts
 * @param {string} [opts.token]            Pre-minted rtc token. If omitted, we mint one
 *                                         via getToken() for the current (cached) room.
 * @param {string} [opts.roomId]           Room to mint the token for, if `token` omitted.
 * @param {number} [opts.samplingDuration] 10000–120000 ms (SDK clamps). Default 12000.
 * @param {boolean}[opts.audioOnly]        Skip the camera test. Default true —
 *                                         a consultation cares about audio first
 *                                         and it works before camera is granted.
 * @returns {Promise<{
 *   raw, aborted, score, rating, label, color,
 *   latencyMs, packetLossPct,
 *   uplink:   { score, rating, label, bitrateKbps, rtt, jitter, packetLossPct },
 *   downlink: { score, rating, label, bitrateKbps, rtt, jitter, packetLossPct },
 * }>}
 */
export async function runNetworkTest({
  token,
  roomId,
  samplingDuration = 12000,
  audioOnly = true,
} = {}) {
  // The meeting's normal rtc token works for runPreCallTest — no dedicated precall
  // token endpoint is needed. Reuse/mint the same rtc token the join flow uses.
  const tok = token || (await getToken({ roomId }));
  const result = await runPreCallTest({ token: tok, audioOnly, samplingDuration });
  return normalise(result);
}

function direction(dir) {
  if (!dir) return null;
  const media = dir.video ?? dir.audio ?? {};
  const rating = ratingFromScore(dir.quality);
  return {
    score: dir.quality ?? null,
    rating,
    ...RATINGS[rating],
    bitrateKbps: round(media.bitrate),
    rtt: round(media.rtt),
    jitter: round(media.jitter),
    packetLossPct: media.packetLoss == null ? null : Math.round(media.packetLoss * 10) / 10,
  };
}

function normalise(result) {
  // Runtime key is `networkQuality`; fall back to `network` to match the docs’
  // type in case a future patch aligns them.
  const nq = result?.networkQuality ?? result?.network ?? null;
  const uplink = direction(nq?.uplink);
  const downlink = direction(nq?.downlink);

  // Overall = worst direction (pessimistic, matching the SDK’s own minScore).
  const scores = [uplink?.score, downlink?.score].filter((s) => s != null);
  const score = scores.length ? Math.min(...scores) : null;
  const rating = ratingFromScore(score);

  // Surface a single round-trip latency (worst direction) for the detail line.
  const rtts = [uplink?.rtt, downlink?.rtt].filter((r) => r != null);
  const losses = [uplink?.packetLossPct, downlink?.packetLossPct].filter((p) => p != null);

  return {
    raw: result,
    aborted: !!result?.aborted,
    score,
    rating,
    ...RATINGS[rating],
    latencyMs: rtts.length ? Math.max(...rtts) : null,
    packetLossPct: losses.length ? Math.max(...losses) : null,
    uplink,
    downlink,
  };
}
