import { createCameraVideoTrack, createMicrophoneAudioTrack } from "@videosdk.live/react-sdk";
import { useCallback } from "react";
import { useMeetingStore } from "../store/meetingStore";
import {
  applyVirtualBackground,
  isVirtualBackgroundRunning,
  stopVirtualBackground,
} from "../lib/virtualBackground";
import { trackMedia } from "../lib/mediaTracks";

// Single source of truth for every camera/mic track in the app. The pre-call
// preview track IS the track published into the meeting, so both use these.
export const VIDEO_TRACK_CONFIG = {
  encoderConfig: "h480p_w640p",
  optimizationMode: "motion",
  codec: "H264",
};
export const AUDIO_TRACK_CONFIG = { encoderConfig: "speech_standard" };

const AUDIO_TIMEOUT_MS = 10000;

// Camera track (480p; simulcast for the doctor, single layer for the patient).
// For the agent, the chosen virtual
// background is applied on top, so preview / in-call / re-enable all match.
export async function createVideoTrack(cameraId) {
  try {
    // Simulcast for the doctor only — must match the MeetingProvider config in
    // App.js, or the published track and the provider disagree on layer count.
    const { isDoctor, useVirtualBackground } = useMeetingStore.getState();
    const track = trackMedia(
      await createCameraVideoTrack({
        cameraId: cameraId || undefined,
        ...VIDEO_TRACK_CONFIG,
        multiStream: isDoctor,
      })
    );
    if (!track) return null;

    if (useVirtualBackground) {
      try {
        return trackMedia(await applyVirtualBackground(track));
      } catch (error) {
        console.warn("Virtual background failed, using plain camera:", error);
      }
    } else if (isVirtualBackgroundRunning()) {
      await stopVirtualBackground();
    }
    return track;
  } catch (error) {
    console.error("createVideoTrack error:", error);
    return null;
  }
}

// Mic track. Some USB mics make createMicrophoneAudioTrack hang forever, so
// race a timeout — worst case we continue without audio instead of stalling.
export async function createAudioTrack(micId) {
  try {
    return await Promise.race([
      createMicrophoneAudioTrack({ microphoneId: micId || undefined, ...AUDIO_TRACK_CONFIG }).then(trackMedia),
      new Promise((_, reject) => setTimeout(() => reject(new Error("audio track timeout")), AUDIO_TIMEOUT_MS)),
    ]);
  } catch (error) {
    console.error("createAudioTrack error:", error);
    return null;
  }
}

// Hook wrapper kept for existing call sites; falls back to the selected devices.
const useMediaStream = () => {
  const getVideoTrack = useCallback(
    ({ webcamId } = {}) => createVideoTrack(webcamId || useMeetingStore.getState().selectedWebcam?.id),
    []
  );
  const getAudioTrack = useCallback(
    ({ micId } = {}) => createAudioTrack(micId || useMeetingStore.getState().selectedMicrophone?.id),
    []
  );
  return { getVideoTrack, getAudioTrack };
};

export default useMediaStream;
