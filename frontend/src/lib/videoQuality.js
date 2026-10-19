// Patient camera quality presets, shared by the media hooks, the store and the
// doctor's control. Kept in its own module (no imports) so the store can read it
// without an import cycle through useMediaStream.

export const PATIENT_QUALITY_PRESETS = {
  180: "h180p_w320p",
  360: "h360p_w640p",
  540: "h540p_w960p",
};
// TEMP: every camera track handed to MeetingProvider (the pre-call track that
// becomes customCameraVideoTrack) is hardcoded to 180p, for both roles. The
// doctor can still switch the patient to 360 / 540 mid-call. Set to null to
// go back to the per-role presets.
export const TEMP_PROVIDER_QUALITY = 180;

// PubSub topic the doctor publishes the chosen patient quality on.
export const PATIENT_VIDEO_QUALITY_TOPIC = "PATIENT_VIDEO_QUALITY";
