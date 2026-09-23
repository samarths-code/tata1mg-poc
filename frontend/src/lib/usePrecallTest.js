// usePrecallTest — runs VideoSDK's runPreCallTest on the pre-call screen's own
// tracks, and hands the result's tracks to the join.
//
//  • The test runs on the exact audio/video MediaStreams being previewed. If
//    they change (device switch, background, mic/camera toggle) the running
//    test is stopped and restarted, so the result always matches the tracks
//    the user will join with.
//  • finish() is called on Join: if the test is still sampling it calls the
//    SDK's stop() (the promise then resolves with the partial result), and
//    returns the raw result — whose camera.track / microphone.track go
//    straight into MeetingProvider.
import { useCallback, useEffect, useRef, useState } from "react";
import { normaliseResult, startNetworkTest, PRECALL_SAMPLING_MS } from "./precallTest";

// Tracks settle in bursts on mount (mic, then camera) — wait before starting.
const START_DEBOUNCE_MS = 800;

// status: "idle" | "loading" | "success" | "timeout" | "no-wifi"
export default function usePrecallTest({
  token,
  audioStream,
  videoStream,
  enabled = true,
  samplingDuration = PRECALL_SAMPLING_MS,
}) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [runId, setRunId] = useState(0); // bump to re-run (Retry)
  // { test, promise } for the current run. `promise` never rejects: it
  // resolves to the raw result or null.
  const currentRef = useRef(null);

  const stopCurrent = useCallback(async () => {
    const cur = currentRef.current;
    if (!cur) return null;
    try { await cur.test.stop(); } catch (e) { /* idempotent */ }
    return cur.promise;
  }, []);

  useEffect(() => {
    if (!enabled || !token || !audioStream) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      // One test at a time (SDK singleton) — tear down the previous run first.
      await stopCurrent();
      if (cancelled) return;

      setStatus("loading");
      setResult(null);
      let test;
      try {
        test = startNetworkTest({ token, audioStream, videoStream, samplingDuration });
      } catch (e) {
        setStatus("timeout");
        return;
      }
      const run = {
        test,
        promise: test.then(
          (raw) => raw,
          (err) => {
            if (currentRef.current === run && !cancelled) {
              const msg = String(err?.message ?? err);
              setStatus(/no[\s-]?network|no[\s-]?wifi/i.test(msg) ? "no-wifi" : "timeout");
            }
            return null;
          }
        ),
      };
      currentRef.current = run;
      const raw = await run.promise;
      if (cancelled || currentRef.current !== run || !raw) return;
      const stats = normaliseResult(raw);
      setResult(stats);
      // Stopped early (Join) → keep whatever was measured so far.
      setStatus(stats.rating === "unknown" && !raw.aborted ? "timeout" : "success");
    }, START_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, token, audioStream, videoStream, samplingDuration, runId, stopCurrent]);

  // Stop the test when the screen goes away / is disabled (e.g. joined).
  useEffect(() => {
    if (!enabled) stopCurrent();
    return () => { stopCurrent(); };
  }, [enabled, stopCurrent]);

  // Join: stop if still sampling, return the raw result (or null).
  const finish = useCallback(async () => stopCurrent(), [stopCurrent]);

  const retry = useCallback(() => setRunId((n) => n + 1), []);

  return { status, result, retry, finish };
}
