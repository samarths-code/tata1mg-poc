// usePrecallTest — a small React wrapper around VideoSDK's runPreCallTest.
//
// @videosdk.live/react-sdk@0.12.5 does NOT ship a `usePrecallTest` hook — it
// only exposes the imperative runPreCallTest() function. This hook gives that
// function React ergonomics: it owns the loading/result state machine and
// auto-runs the check once the meeting token is available.
//
// It deliberately does NOT mint its own token — it uses the token the join
// flow already holds (passed in), matching runPreCallTest's docs.
import { useCallback, useEffect, useRef, useState } from "react";
import { runNetworkTest } from "./precallTest";

// status: "idle" | "loading" | "success" | "timeout" | "no-wifi"
export default function usePrecallTest({
  token,
  samplingDuration = 12000,
  audioOnly = true,
  auto = true,
} = {}) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (!token || runningRef.current) return;
    runningRef.current = true;
    setStatus("loading");
    try {
      const stats = await runNetworkTest({ token, samplingDuration, audioOnly });
      setResult(stats);
      setStatus(stats?.rating === "unknown" ? "timeout" : "success");
    } catch (ex) {
      const msg = String(ex?.message ?? ex);
      setStatus(/no[\s-]?network|no[\s-]?wifi/i.test(msg) ? "no-wifi" : "timeout");
    } finally {
      runningRef.current = false;
    }
  }, [token, samplingDuration, audioOnly]);

  // Auto-run once the token becomes available.
  useEffect(() => {
    if (auto && token) run();
  }, [auto, token, run]);

  return { status, result, run };
}
