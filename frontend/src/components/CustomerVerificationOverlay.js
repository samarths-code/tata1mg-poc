import React, { useState, useEffect, useRef } from "react";
import { useMeeting, usePubSub, VideoPlayer } from "@videosdk.live/react-sdk";
import useIsMobile from "../hooks/useIsMobile";

function Spinner() {
  return (
    <div
      className="relative w-12 h-12 animate-spin"
      style={{ animationDuration: "0.8s" }}
    >
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <div
          key={deg}
          className="absolute inset-0 flex items-start justify-center pt-0.5"
          style={{ transform: `rotate(${deg}deg)` }}
        >
          <div
            className="w-[3px] h-[13px] bg-white rounded-full"
            style={{ opacity: (i + 1) / 8 }}
          />
        </div>
      ))}
    </div>
  );
}

export function CustomerVerificationOverlay() {
  const { localParticipant } = useMeeting();
  const isMobile = useIsMobile();
  const [step, setStep] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [phase, setPhase] = useState(null); // null | 'loading' | 'document' | 'face'
  const [captureActive, setCaptureActive] = useState(false);
  const [captureVariant, setCaptureVariant] = useState("document");
  const timerRef = useRef(null);

  usePubSub("CAPTURE_STATE", {
    onMessageReceived: ({ payload }) => {
      setCaptureActive(payload?.active === true);
      if (payload?.variant) setCaptureVariant(payload.variant);
    },
  });

  usePubSub("VERIFICATION_STEP", {
    onMessageReceived: ({ payload }) => {
      if (payload?.step != null) setStep(payload.step);
      if (Array.isArray(payload?.completed)) setCompleted(payload.completed);
    },
    onOldMessagesReceived: (messages) => {
      const last = messages[messages.length - 1];
      if (last?.payload?.step != null) setStep(last.payload.step);
      if (Array.isArray(last?.payload?.completed)) setCompleted(last.payload.completed);
    },
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // No step or step 1 → no overlay
    if (!step || step === 1) {
      setPhase(null);
      return;
    }

    // Step has been approved by doctor → clear overlay
    if (completed.includes(step)) {
      setPhase(null);
      return;
    }

    setPhase("loading");
    timerRef.current = setTimeout(() => {
      setPhase(step === 2 ? "document" : "face");
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, completed]);

  if (!phase) return null;

  const localId = localParticipant?.id;

  // ── Loading ────────────────────────────────────────────────────────────────
  // Semi-transparent overlay — doctor's video shows through dimly
  if (phase === "loading") {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70">
        <Spinner />
        <p
          className="text-white text-2xl font-medium text-center leading-8"
          style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
        >
          {step === 2 ? (
            <>
              Please keep your document
              <br />
              ready for verification.
            </>
          ) : step === 4 ? (
            <>
              Please get ready for
              <br />
              body type analysis.
            </>
          ) : (
            <>
              Please get ready for
              <br />
              face verification.
            </>
          )}
        </p>
      </div>
    );
  }

  // ── Document / Face ────────────────────────────────────────────────────────
  // Only mount the camera overlay while the doctor has capture active.
  // This prevents the dark screen persisting after the doctor cancels.
  if (!captureActive) return null;

  const isFace = captureVariant === "face";

  // Mirror exact frameStyle from CaptureOverlay so both sides are identical.
  const frameStyle = isFace
    ? { width: "min(55%, 380px)", aspectRatio: "3 / 4" }
    : { width: "min(72%, 560px)", aspectRatio: "16 / 10", maxHeight: "42%", maxWidth: "88%" };

  const heading = isFace
    ? "Please position yourself clearly in front of the camera."
    : "Hold the document steady inside the frame";

  return (
    <div className="absolute inset-0 z-10 bg-[#1b1b1e] overflow-hidden">
      {/* Local camera feed.
          Document phase: flip the wrapper to cancel the browser's default
          front-camera mirror so card text appears readable.
          Face phase: keep natural mirror (selfie feel). */}
      {localId && (
        <div
          className="absolute inset-0"
          style={!isFace ? { transform: "scaleX(-1)" } : undefined}
        >
          <VideoPlayer
            participantId={localId}
            type="video"
            containerStyle={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            className="h-full w-full"
            videoStyle={{ height: "100%", width: "100%", objectFit: isMobile ? "cover" : "contain" }}
          />
        </div>
      )}

      {/* Dark scrim */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Patient name */}
      <p
        className="absolute bottom-5 left-5 text-white text-base font-medium"
        style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
      >
        {localParticipant?.displayName}
      </p>

      {/* Guide frame — same dimensions as doctor's CaptureOverlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-16 pointer-events-none"
      >
        {!isFace && (
          <p className="text-white text-lg font-medium mb-4 text-center drop-shadow-lg">{heading}</p>
        )}
        <div
          style={{
            ...frameStyle,
            border: "3px dashed #4bd559",
            borderRadius: isFace ? "24px" : "12px",
          }}
        />
        {isFace && (
          <p className="text-white text-lg font-medium mt-4 text-center drop-shadow-lg">{heading}</p>
        )}
      </div>
    </div>
  );
}
