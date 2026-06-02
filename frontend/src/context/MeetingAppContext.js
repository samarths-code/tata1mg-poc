import { useEffect, useRef } from "react";
import { useMeetingStore, useMeetingAppContext } from "../store/meetingStore";

/**
 * Backwards-compatible shim over the zustand meeting store.
 *
 * `MeetingAppProvider` no longer holds state in a Context value object — it
 * just seeds the store from props. `useMeetingAppContext` is re-exported from
 * the store and is selector-aware, so existing call sites keep working while
 * new/hot code can subscribe to a single slice to avoid re-renders.
 */
export { useMeetingAppContext };

export const MeetingAppProvider = ({
  children,
  initialMicOn,
  initialWebcamOn,
  initialSpeakerOn,
  participantMode,
  caseId,
}) => {
  // Seed the store once, synchronously, before children first render.
  const seeded = useRef(false);
  if (!seeded.current) {
    useMeetingStore.getState().setSessionConfig({
      initialMicOn,
      initialWebcamOn,
      initialSpeakerOn,
      participantMode,
      caseId,
    });
    seeded.current = true;
  }

  // Keep muteSpeaker in sync if the speaker prop changes after mount.
  useEffect(() => {
    useMeetingStore.getState().setMuteSpeaker(initialSpeakerOn);
  }, [initialSpeakerOn]);

  return children;
};
