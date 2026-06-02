import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { VirtualBackgroundProcessor } from "@videosdk.live/videosdk-media-processor-web";
import { participantModes } from "../utils/common";

/**
 * Global meeting store (zustand).
 *
 * Replaces the previous React Context so components can subscribe to *only*
 * the slices they read — preventing the broad re-renders a single Context
 * value object caused on every state change (important in a live video call).
 *
 * Setters accept either a value or an updater function, so they are drop-in
 * compatible with the old `useState`-style setters used across the app.
 */

// Singleton — previously re-created on every Context render (a real bug).
const videoProcessor = new VirtualBackgroundProcessor();

// Helper: build a setter that supports value | (prev) => next, like useState.
const updater = (set, key) => (v) =>
  set((s) => ({ [key]: typeof v === "function" ? v(s[key]) : v }));

export const useMeetingStore = create((set) => ({
  // ── Session config (seeded once from props) ────────────────────────────────
  initialMicOn: true,
  initialWebcamOn: true,
  participantMode: undefined,
  caseId: "",

  // ── Derived flags (recomputed when session config is seeded) ───────────────
  isDoctor: false,
  allowedVirtualBackground: false,
  maintainVideoAspectRatio: false,
  maintainLandscapeVideoAspectRatio: true,
  canRemoveOtherParticipant: false,

  // ── UI / sidebar ───────────────────────────────────────────────────────────
  sideBarMode: null,
  meetingMode: null,
  images: [],
  raisedHandsParticipants: [],

  // ── Devices / permissions ──────────────────────────────────────────────────
  selectedMicrophone: { id: null, label: null },
  selectedMicDevice: { id: null, label: null },
  selectedWebcam: { id: null, label: null },
  selectedSpeaker: { id: null, label: null },
  selectedOutputDevice: { id: null, label: null },
  isCameraPermissionAllowed: null,
  isMicrophonePermissionAllowed: null,
  useVirtualBackground: false,
  webCamResolution: "h480p_w640p",
  cameraFacingMode: { facingMode: "front" },
  muteSpeaker: true,
  participantLeftReason: null,

  // ── MER captured data ──────────────────────────────────────────────────────
  geoData: null,
  customerPhoto: null,
  aadhaarPhoto: null,
  submissionStatus: "idle",

  // ── Vision AI ──────────────────────────────────────────────────────────────
  referencePhoto: null,
  customerSpoofStatus: null,

  videoProcessor,

  // ── Session seeding ────────────────────────────────────────────────────────
  setSessionConfig: ({ initialMicOn, initialWebcamOn, initialSpeakerOn, participantMode, caseId }) =>
    set(() => {
      const isDoctor =
        participantMode === participantModes.DOCTOR ||
        participantMode === participantModes.AGENT;
      return {
        initialMicOn,
        initialWebcamOn,
        participantMode,
        caseId,
        muteSpeaker: initialSpeakerOn,
        isDoctor,
        maintainVideoAspectRatio: isDoctor,
        canRemoveOtherParticipant: isDoctor,
      };
    }),

  // ── Setters (value | updater-fn compatible) ────────────────────────────────
  setSideBarMode: updater(set, "sideBarMode"),
  setMeetingMode: updater(set, "meetingMode"),
  setImages: updater(set, "images"),
  setRaisedHandsParticipants: updater(set, "raisedHandsParticipants"),
  setSelectedMicroPhone: updater(set, "selectedMicrophone"),
  setSelectedMicDevice: updater(set, "selectedMicDevice"),
  setSelectedWebcam: updater(set, "selectedWebcam"),
  setSelectedSpeaker: updater(set, "selectedSpeaker"),
  setSelectedOutputDevice: updater(set, "selectedOutputDevice"),
  setIsCameraPermissionAllowed: updater(set, "isCameraPermissionAllowed"),
  setIsMicrophonePermissionAllowed: updater(set, "isMicrophonePermissionAllowed"),
  setUseVirtualBackground: updater(set, "useVirtualBackground"),
  setWebCamResolution: updater(set, "webCamResolution"),
  setCameraFacingMode: updater(set, "cameraFacingMode"),
  setMuteSpeaker: updater(set, "muteSpeaker"),
  setParticipantLeftReason: updater(set, "participantLeftReason"),
  setGeoData: updater(set, "geoData"),
  setCustomerPhoto: updater(set, "customerPhoto"),
  setAadhaarPhoto: updater(set, "aadhaarPhoto"),
  setSubmissionStatus: updater(set, "submissionStatus"),
  setReferencePhoto: updater(set, "referencePhoto"),
  setCustomerSpoofStatus: updater(set, "customerSpoofStatus"),
}));

/**
 * Selector-aware access hook (backward compatible with the old Context API).
 *
 *  - `useMeetingAppContext(s => s.customerPhoto)`  → subscribes to ONE slice (no extra re-renders)
 *  - `useMeetingAppContext(s => ({ a: s.a, b: s.b }))` → object selector, shallow-compared
 *  - `useMeetingAppContext()` → whole store (legacy; re-renders on any change)
 *
 * Prefer passing a selector. The no-arg form exists only so existing call
 * sites keep working during the migration.
 */
const identity = (s) => s;
export function useMeetingAppContext(selector) {
  // Object selectors need shallow comparison to avoid re-rendering on every set.
  // useShallow is a hook, so it must be called unconditionally.
  return useMeetingStore(useShallow(selector || identity));
}
