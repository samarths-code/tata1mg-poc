import { Constants, createCameraVideoTrack, createMicrophoneAudioTrack } from "@videosdk.live/react-sdk";
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
  optimizationMode: "motion",
  bitrateMode: Constants.BitrateMode.BANDWIDTH_OPTIMIZED, // HIGH_QUALITY | BALANCED | BANDWIDTH_OPTIMIZED
  codec: "H264",
};
// Per-role resolution: the doctor's self-view only needs 180p. The patient's
// camera is what the doctor inspects; it defaults to 360p and the doctor can
// switch it to 180 / 360 / 540 mid-call (see usePatientVideoQuality).
const DOCTOR_ENCODER_CONFIG = "h180p_w320p";
export const PATIENT_QUALITY_PRESETS = {
  180: "h180p_w320p",
  360: "h360p_w640p",
  540: "h540p_w960p",
};
// PubSub topic the doctor publishes the chosen patient quality on.
export const PATIENT_VIDEO_QUALITY_TOPIC = "PATIENT_VIDEO_QUALITY";
// PubSub topic the patient reports the quality its camera ACTUALLY has on, so
// the doctor's control can show applied / applying / failed.
export const PATIENT_VIDEO_QUALITY_STATE_TOPIC = "PATIENT_VIDEO_QUALITY_STATE";
export const DEFAULT_PATIENT_QUALITY = 360;
export const AUDIO_TRACK_CONFIG = { encoderConfig: "speech_standard" };

const AUDIO_TIMEOUT_MS = 10000;

// Camera track (180p doctor / doctor-chosen preset for the patient; simulcast for the doctor, single layer for the patient).
// For the agent, the chosen virtual
// background is applied on top, so preview / in-call / re-enable all match.
export async function createVideoTrack(cameraId) {
  try {
    // Simulcast for the doctor only — must match the MeetingProvider config in
    // App.js, or the published track and the provider disagree on layer count.
    const { isDoctor, useVirtualBackground, patientVideoQuality } = useMeetingStore.getState();
    const patientQuality = PATIENT_QUALITY_PRESETS[patientVideoQuality]
      ? patientVideoQuality
      : DEFAULT_PATIENT_QUALITY;
    const track = trackMedia(
      await createCameraVideoTrack({
        cameraId: cameraId || undefined,
        ...VIDEO_TRACK_CONFIG,
        encoderConfig: isDoctor ? DOCTOR_ENCODER_CONFIG : PATIENT_QUALITY_PRESETS[patientQuality],
        multiStream: isDoctor,
      })
    );
    if (!track) return null;
    // Record what the patient's camera really opened at (see usePatientVideoQuality).
    if (!isDoctor) useMeetingStore.getState().setPatientTrackQuality(patientQuality);

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
