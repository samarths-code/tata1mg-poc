import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useEffect, useRef } from "react";
import { useMeetingStore } from "../store/meetingStore";
import {
  createVideoTrack,
  PATIENT_QUALITY_PRESETS,
  PATIENT_VIDEO_QUALITY_STATE_TOPIC,
  PATIENT_VIDEO_QUALITY_TOPIC,
} from "./useMediaStream";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

// The track currently published from this device's camera, if any.
function publishedVideoTrack(meeting) {
  for (const stream of meeting?.localParticipant?.streams?.values?.() ?? []) {
    if (stream?.kind === "video") return stream.track;
  }
  return null;
}

// Patient side of the doctor's 180 / 360 / 540 control.
//
// The first camera track of a session is always 360p (pre-call / rejoin).
// After that, the doctor's latest choice (persisted on the topic, so it also
// reaches a patient who joins or reloads later) is the target, and the hook
// keeps the ACTUAL track converged on it:
//   - compares against the quality the camera really has (store
//     patientTrackQuality), not the last request — so a failed swap, or a
//     retry of the same value, is never skipped as "already applied";
//   - re-checks whenever the camera comes on (the choice may have arrived
//     while it was off, or before the track was published);
//   - retries a failed swap a few times, then keeps the working camera;
//   - reports { quality, requested, cameraOn, failed } back to the doctor.
export default function usePatientVideoQuality({ enabled }) {
  const mMeeting = useMeeting();
  const meetingRef = useRef(mMeeting);
  meetingRef.current = mMeeting;
  const busyRef = useRef(false);
  const rerunRef = useRef(false);
  const failedRef = useRef(false);

  const { publish: publishState } = usePubSub(PATIENT_VIDEO_QUALITY_STATE_TOPIC, {});
  const lastReportRef = useRef("");
  const report = () => {
    if (!enabled) return;
    const { patientVideoQuality, patientTrackQuality } = useMeetingStore.getState();
    const state = {
      quality: patientTrackQuality,
      requested: patientVideoQuality,
      cameraOn: !!meetingRef.current?.localWebcamOn,
      failed: failedRef.current,
    };
    const key = JSON.stringify(state);
    if (key === lastReportRef.current) return; // nothing changed
    lastReportRef.current = key;
    Promise.resolve(publishState("state", { persist: true }, state)).catch(() => {
      lastReportRef.current = ""; // let the next change re-send it
    });
  };

  const reconcile = async () => {
    if (!enabled) return;
    if (busyRef.current) { rerunRef.current = true; return; }
    busyRef.current = true;
    try {
      do {
        rerunRef.current = false;
        let attempts = 0;
        for (;;) {
          const store = useMeetingStore.getState();
          const meeting = meetingRef.current;
          // Camera off: the next camera-on opens at the requested preset
          // (createVideoTrack reads it), and the effect below re-checks.
          if (!meeting?.localWebcamOn) break;
          if (store.patientTrackQuality === store.patientVideoQuality) { failedRef.current = false; break; }
          if (attempts >= MAX_ATTEMPTS) { failedRef.current = true; break; } // keep the working camera

          attempts += 1;
          const old = publishedVideoTrack(meeting);
          const track = await createVideoTrack(store.selectedWebcam?.id); // sets patientTrackQuality on success
          if (!track) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          meeting.changeWebcam(track);
          // Release the previous camera track so the phone isn't holding two.
          const next = track.getVideoTracks?.()[0];
          if (old && old !== next) old.stop();
        }
      } while (rerunRef.current); // a new choice landed mid-swap
    } catch (e) {
      console.warn("Patient video quality change failed:", e);
      failedRef.current = true;
    } finally {
      busyRef.current = false;
      report();
    }
  };

  const apply = (quality) => {
    if (!enabled || !PATIENT_QUALITY_PRESETS[quality]) return;
    useMeetingStore.getState().setPatientVideoQuality(quality);
    failedRef.current = false; // a fresh request (incl. a doctor retry) gets fresh attempts
    reconcile();
  };

  usePubSub(PATIENT_VIDEO_QUALITY_TOPIC, {
    onMessageReceived: ({ payload }) => apply(Number(payload?.quality)),
    onOldMessagesReceived: (messages) => {
      const last = messages[messages.length - 1];
      if (last) apply(Number(last.payload?.quality));
      else report(); // no choice yet — tell the doctor we're at the 360p default
    },
  });

  // Camera turned on / track (re)published: converge on the current request
  // and tell the doctor what we now have.
  const camOn = !!mMeeting?.localWebcamOn;
  useEffect(() => {
    if (!enabled) return;
    reconcile();
    report();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, camOn]);
}
