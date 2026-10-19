// Patient camera quality presets, shared by the media hooks, the store and the
// doctor's control. Kept in its own module (no imports) so the store can read it
// without an import cycle through useMediaStream.

export const PATIENT_QUALITY_PRESETS = {
  180: "h180p_w320p",
  360: "h360p_w640p",
  540: "h540p_w960p",
};
// PubSub topic the doctor publishes the chosen patient quality on.
export const PATIENT_VIDEO_QUALITY_TOPIC = "PATIENT_VIDEO_QUALITY";
