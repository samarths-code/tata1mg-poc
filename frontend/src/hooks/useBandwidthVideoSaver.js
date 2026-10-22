import { useCallback, useEffect, useRef, useState } from "react";

// Goal: when the PATIENT's connection is struggling, stop the doctor's video
// being delivered to them, so their downlink is freed. The patient's own camera
// is never touched — the doctor must keep seeing them throughout the
// consultation — and neither is the doctor's: nothing local is stopped on
// either side, we just stop the SFU forwarding that stream to the patient.
//
//   useLimitationDetector  — patient: decides, from its own signals
//   useIncomingVideoPause  — patient: pauses/resumes what the SFU sends it
//
// Triggers: the SDK's onQualityLimitation types. `externalActive` can feed in
// measured signals under their own names too, but nothing does right now.
export const DEFAULT_TRIGGERS = ["bandwidth", "congestion", "cpu"];
export const DEFAULT_RESTORE_DELAY_MS = 3000;

// phase: "idle"    — patient is fine; the doctor's video is delivered
//        "saving"  — at least one trigger active; delivery paused
//        "pending" — triggers cleared, waiting out the delay. Still paused:
//                    we only resume once the quiet period completes.
export function useLimitationDetector({
  enabled,
  triggers = DEFAULT_TRIGGERS,
  restoreDelayMs = DEFAULT_RESTORE_DELAY_MS,
  limitationEvent,
  externalActive = [],
  onPhaseChange,
}) {
  const [phase, setPhase] = useState("idle");

  // A set, not a flag: "bandwidth resolved" must not restore video while
  // "downlink" is still bad.
  const activeRef = useRef(new Set());
  const restoreTimerRef = useRef(null);
  const phaseRef = useRef("idle");

  const externalRef = useRef(externalActive);
  externalRef.current = externalActive;

  const onPhaseChangeRef = useRef(onPhaseChange);
  useEffect(() => { onPhaseChangeRef.current = onPhaseChange; }, [onPhaseChange]);

  const currentActive = useCallback(
    () => [...new Set([...activeRef.current, ...externalRef.current])]
      .filter((t) => triggers.includes(t)),
    [triggers]
  );

  const emit = useCallback((next, reasons) => {
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    setPhase(next);
    onPhaseChangeRef.current?.({ phase: next, reasons: reasons ?? [] });
  }, []);

  const evaluate = useCallback(() => {
    clearTimeout(restoreTimerRef.current);

    if (!enabled) {
      activeRef.current.clear();
      emit("idle", []);
      return;
    }

    const active = currentActive();
    if (active.length > 0) {
      emit("saving", active);
      return;
    }

    // Only wait out the delay if we were actually holding video off.
    if (phaseRef.current === "saving" || phaseRef.current === "pending") {
      emit("pending", []);
      restoreTimerRef.current = setTimeout(() => {
        // Nothing came back during the quiet period → safe to restore.
        if (currentActive().length === 0) emit("idle", []);
      }, restoreDelayMs);
      return;
    }

    emit("idle", []);
  }, [enabled, restoreDelayMs, currentActive, emit]);

  // Fold each SDK limitation edge into the active set.
  useEffect(() => {
    if (!limitationEvent) return;
    const { type, state } = limitationEvent;
    if (!triggers.includes(type)) return;
    if (state === "detected") activeRef.current.add(type);
    else if (state === "resolved") activeRef.current.delete(type);
    evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitationEvent]);

  // Re-decide when the measured signals, the checkboxes, the master switch or
  // the delay change.
  useEffect(() => {
    [...activeRef.current].forEach((type) => {
      if (!triggers.includes(type)) activeRef.current.delete(type);
    });
    evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, triggers.join(","), restoreDelayMs, externalActive.join(",")]);

  useEffect(() => () => clearTimeout(restoreTimerRef.current), []);

  return { phase, activeTypes: currentActive() };
}

// Stops the INCOMING video from being forwarded to us. This is the thing that
// actually saves the patient's downlink: pauseAllStreams("video") is a server
// request (roomClient.pauseAllConsumers → socket "pauseAllConsumers"), so the
// SFU stops sending those bytes down.
//
// Nothing local is stopped. The doctor's camera, their self-view, the virtual
// background and their uplink all carry on untouched, so resuming is instant —
// no camera re-acquisition, no background reload, no 3031.
//
// "saving" and "pending" both mean paused: during pending we're still waiting
// to see whether the trouble returns, so video must not flick back on.
export function useIncomingVideoPause({ enabled, phase, meetingRef, onPausedChange }) {
  const pausedRef = useRef(false);
  const busyRef = useRef(false);
  const onPausedChangeRef = useRef(onPausedChange);
  useEffect(() => { onPausedChangeRef.current = onPausedChange; }, [onPausedChange]);

  useEffect(() => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    const shouldPause = enabled && (phase === "saving" || phase === "pending");
    if (shouldPause === pausedRef.current) return;
    // Tell the UI immediately — the placeholder must not wait on a round trip,
    // and must not depend on the SDK emitting onStreamPaused for our own pause.
    onPausedChangeRef.current?.(shouldPause);

    let cancelled = false;
    (async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        // THIS is what saves the bandwidth: a socket request telling the SFU to
        // stop forwarding video to us. Hiding the <video> element would not —
        // the consumer stays subscribed and the bytes keep arriving.
        if (shouldPause) await meeting.pauseAllStreams("video");
        else await meeting.resumeAllStreams("video");
        if (!cancelled) pausedRef.current = shouldPause;
      } catch (e) {
        console.warn("Incoming video pause failed:", e);
      } finally {
        busyRef.current = false;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, enabled]);

  // Leaving the feature on with video paused would strand it — resume on unmount.
  useEffect(() => () => {
    if (pausedRef.current) {
      try { meetingRef.current?.resumeAllStreams("video"); } catch (e) { /* leaving anyway */ }
      onPausedChangeRef.current?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { paused: pausedRef.current };
}
