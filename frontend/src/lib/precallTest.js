// precallTest.js — VideoSDK pre-call network check.
//
// runPreCallTest() runs against the SAME camera/mic tracks the pre-call screen
// previews (passed as videoTrack/audioTrack). Its result echoes those streams
// back as result.camera.track / result.microphone.track, and the join flow
// hands exactly those into MeetingProvider — so what was tested is what's sent.
//
//   • It needs a `token` (it spins up a short, real test connection).
//   • Resolved shape: { aborted, testDuration, camera, microphone, networkQuality }
//     where networkQuality (the TS types call it `network`) is
//     { audioOnly, uplink, downlink }, each { quality /* 0–10 */, audio:{…}, video:{…} }.
//   • The returned promise has .stop(); stopping early still resolves with the
//     partial result (aborted: true). Caller-supplied tracks are left running.
//
// For in-call quality use the participant's getAudioStats()/getVideoStats().
import { runPreCallTest } from "@videosdk.live/react-sdk";

export const PRECALL_SAMPLING_MS = 12000;

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
 * Start the SDK pre-call test on the given (pre-call) tracks.
 * Returns the SDK's promise-with-stop() as-is.
 */
export function startNetworkTest({ token, audioStream, videoStream, samplingDuration = PRECALL_SAMPLING_MS }) {
  if (!token) throw new Error("startNetworkTest: token is required");
  return runPreCallTest({
    token,
    samplingDuration,
    audioTrack: audioStream || undefined,
    videoTrack: videoStream || undefined,
    // No camera track (audio-only call / camera off) → don't let the SDK open one.
    audioOnly: !videoStream,
  });
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

// Flatten the raw SDK result for the pre-call badge. `raw` is kept intact —
// it carries camera.track / microphone.track for the join.
export function normaliseResult(result) {
  // Runtime key is `networkQuality`; fall back to `network` (the docs' name).
  const nq = result?.networkQuality ?? result?.network ?? null;
  const uplink = direction(nq?.uplink);
  const downlink = direction(nq?.downlink);

  // Overall = worst direction (pessimistic, matching the SDK's own minScore).
  const scores = [uplink?.score, downlink?.score].filter((s) => s != null);
  const score = scores.length ? Math.min(...scores) : null;
  const rating = ratingFromScore(score);

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
