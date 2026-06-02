import React, { useState, useEffect, useRef } from "react";
import { useMeeting, usePubSub, VideoPlayer } from "@videosdk.live/react-sdk";

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
  const [step, setStep] = useState(null);
  const [phase, setPhase] = useState(null); // null | 'loading' | 'document' | 'face'
  const timerRef = useRef(null);

  usePubSub("VERIFICATION_STEP", {
    onMessageReceived: ({ payload }) => {
      if (payload?.step != null) setStep(payload.step);
    },
    onOldMessagesReceived: (messages) => {
      const last = messages[messages.length - 1];
      if (last?.payload?.step != null) setStep(last.payload.step);
    },
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!step || step === 1) {
      setPhase(null);
      return;
    }

    setPhase("loading");
    timerRef.current = setTimeout(() => {
      setPhase(step === 2 ? "document" : "face");
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step]);

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
  // Local camera fills the screen; alignment guide overlaid on top
  return (
    <div className="absolute inset-0 z-10 bg-[#1b1b1e] overflow-hidden">
      {/* Local camera feed */}
      {localId && (
        <VideoPlayer
          participantId={localId}
          type="video"
          containerStyle={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          className="h-full w-full"
          videoStyle={{ height: "100%", width: "100%", objectFit: "contain" }}
        />
      )}

      {/* Dark scrim */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Patient name */}
      <p
        className="absolute bottom-5 left-5 text-white text-base font-medium"
        style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
      >
        {localParticipant?.displayName}
      </p>

      {/* Document frame — landscape Aadhaar-card shape */}
      {phase === "document" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <p
            className="text-white text-lg font-medium text-center"
            style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
          >
            Hold the document steady inside the frame
          </p>
          <div
            className="border-[3px] border-dashed border-[#4bd559] rounded-[4px] shrink-0"
            style={{ width: 500, height: 269 }}
          />
        </div>
      )}

      {/* Face frame — square */}
      {phase === "face" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div
            className="border-[3px] border-dashed border-[#4bd559] rounded-[20px] shrink-0"
            style={{ width: 500, height: 500 }}
          />
          <p
            className="text-white text-lg font-medium text-center"
            style={{ textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
          >
            Please position yourself clearly in front of the camera.
          </p>
        </div>
      )}
    </div>
  );
}
