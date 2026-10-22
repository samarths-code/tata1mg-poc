import React, { useEffect, useRef, useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import Pill from "../buttons/Pill";
import {
  DEFAULT_PATIENT_QUALITY,
  PATIENT_VIDEO_QUALITY_STATE_TOPIC,
  PATIENT_VIDEO_QUALITY_TOPIC,
} from "../../hooks/useMediaStream";

const OPTIONS = [180, 360, 540];
// How long the patient may lag before we re-send the choice / call it failed.
const RESEND_AFTER_MS = 4000;
const MAX_AUTO_RESENDS = 2;
const GIVE_UP_AFTER_MS = 12000;

// Doctor-only: pick the resolution the patient's camera sends (180p / 360p / 540p).
//
// Two persisted topics keep the two sides in sync:
//   PATIENT_VIDEO_QUALITY        doctor -> patient: the requested quality
//   PATIENT_VIDEO_QUALITY_STATE  patient -> doctor: what the camera ACTUALLY has
// The buttons show the request; hovering shows whether the patient really is
// there, and the selected button turns red if it could not be applied. If the patient never
// picked the request up (joined late, message lost) it is re-sent a couple of
// times; if the patient's swap failed, clicking the selected option retries.
export default function PatientQualityControl({ customerId = null, disabled = false }) {
  const [requested, setRequested] = useState(null); // null = doctor hasn't chosen yet
  const [state, setState] = useState(null); // patient's last report
  const [sentAt, setSentAt] = useState(0);
  const [, forceTick] = useState(0);
  const autoResendsRef = useRef(0);

  const { publish } = usePubSub(PATIENT_VIDEO_QUALITY_TOPIC, {
    onMessageReceived: ({ payload }) => {
      const q = Number(payload?.quality);
      if (OPTIONS.includes(q)) setRequested(q);
    },
    onOldMessagesReceived: (messages) => {
      const q = Number(messages[messages.length - 1]?.payload?.quality);
      if (OPTIONS.includes(q)) setRequested(q);
    },
  });

  usePubSub(PATIENT_VIDEO_QUALITY_STATE_TOPIC, {
    onMessageReceived: ({ payload }) => setState(payload || null),
    onOldMessagesReceived: (messages) => setState(messages[messages.length - 1]?.payload || null),
  });

  // No choice made yet: the patient starts at 360p, so that's what we show.
  const selected = requested ?? DEFAULT_PATIENT_QUALITY;

  const send = async (q) => {
    setRequested(q);
    setSentAt(Date.now());
    try {
      await publish(String(q), { persist: true }, { quality: q });
    } catch (e) {
      console.warn("Publishing patient video quality failed:", e);
    }
  };

  // ── Status: request vs what the patient's camera really has ──────────────
  const patientPresent = !!customerId && !!state;
  const lagMs = sentAt ? Date.now() - sentAt : Infinity;
  let status;
  if (!patientPresent) status = "none";
  else if (!state.cameraOn) status = "off";
  else if (state.quality === selected) status = "applied";
  else if (state.failed && state.requested === selected) status = "failed";
  // Nothing sent from this page (e.g. doctor reloaded mid-switch): trust the
  // patient's own failed flag rather than guessing from a timer.
  else if (!sentAt || lagMs < GIVE_UP_AFTER_MS || state.requested !== selected) status = "applying";
  else status = "failed";

  const choose = (q) => {
    autoResendsRef.current = 0;
    // The selected option again only re-sends when the patient isn't there (retry).
    if (q === selected && status === "applied") return;
    send(q);
  };

  // Patient hasn't picked the request up (joined after we sent it, message
  // lost, reloaded): re-send a couple of times.
  useEffect(() => {
    if (!patientPresent || requested == null) return;
    if (state.requested === requested) return;
    if (autoResendsRef.current >= MAX_AUTO_RESENDS) return;
    const id = setTimeout(() => {
      autoResendsRef.current += 1;
      send(requested);
    }, RESEND_AFTER_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientPresent, requested, state?.requested, sentAt]);

  // Re-render once the give-up window passes so "applying" can turn into "failed".
  useEffect(() => {
    if (status !== "applying" || !sentAt) return;
    const id = setTimeout(() => forceTick((n) => n + 1), Math.max(0, GIVE_UP_AFTER_MS - lagMs) + 50);
    return () => clearTimeout(id);
  }, [status, sentAt, lagMs]);

  // Hover text only — no visual indicator besides the red button on failure.
  const statusText = {
    applied: `Patient is at ${selected}p`,
    applying: `Switching patient to ${selected}p…`,
    failed: `Not applied — patient is at ${state?.quality ?? "?"}p. Click ${selected}p to retry.`,
    off: `Patient camera is off — ${selected}p applies when it turns on`,
    none: null,
  }[status];

  return (
    <Pill>
      <div
        role="radiogroup"
        aria-label="Patient video quality"
        title={statusText || "Patient video quality"}
        className="flex items-center gap-0.5"
      >
        {OPTIONS.map((q) => (
          <button
            key={q}
            role="radio"
            aria-checked={selected === q}
            disabled={disabled}
            onClick={() => choose(q)}
            className={`h-6 px-2 rounded text-xs font-medium tabular-nums transition-colors disabled:opacity-40 ${
              selected === q
                ? status === "failed"
                  ? "bg-[#FF5D5D] text-white"
                  : "bg-white text-black"
                : "text-[#919093] hover:text-white"
            }`}
          >
            {q}p
          </button>
        ))}
      </div>
    </Pill>
  );
}
