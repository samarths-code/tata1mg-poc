import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
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

const isDesktop = () =>
  typeof window !== "undefined" && !window.matchMedia("(max-width: 767px)").matches;

// Helper: build a setter that supports value | (prev) => next, like useState.
const updater = (set, key) => (v) =>
  set((s) => ({ [key]: typeof v === "function" ? v(s[key]) : v }));

export const useMeetingStore = create((set) => ({
  // ── Session config (seeded once from props) ────────────────────────────────
  initialMicOn: true,
  initialWebcamOn: true,
  participantMode: undefined,
  caseId: "",
  // Audio-only call: no camera is ever requested, rendered or published.
  isAudioOnly: false,

  // ── Derived flags (recomputed when session config is seeded) ───────────────
  isDoctor: false,
  maintainVideoAspectRatio: false,
  maintainLandscapeVideoAspectRatio: true,
  canRemoveOtherParticipant: false,

  // ── UI / sidebar ───────────────────────────────────────────────────────────
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
  // Branded background on the doctor's camera (seeded in setSessionConfig).
  useVirtualBackground: false,
  muteSpeaker: true,
  participantLeftReason: null,

  // ── Captured data ──────────────────────────────────────────────────────────
  geoData: null,

  // ── Session seeding ────────────────────────────────────────────────────────
  setSessionConfig: ({ initialMicOn, initialWebcamOn, initialSpeakerOn, participantMode, caseId, isAudioOnly }) =>
    set(() => {
      const isDoctor =
        participantMode === participantModes.DOCTOR ||
        participantMode === participantModes.AGENT;
      return {
        initialMicOn,
        initialWebcamOn,
        participantMode,
        caseId,
        isAudioOnly: !!isAudioOnly,
        muteSpeaker: initialSpeakerOn,
        isDoctor,
        // The doctor's camera always carries the Apollo background. The SDK's
        // processor is desktop-only, so phones stay on the plain camera.
        useVirtualBackground: isDoctor && !isAudioOnly && isDesktop(),
        maintainVideoAspectRatio: isDoctor,
        canRemoveOtherParticipant: isDoctor,
      };
    }),

  // ── Setters (value | updater-fn compatible) ────────────────────────────────
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
  setMuteSpeaker: updater(set, "muteSpeaker"),
  setParticipantLeftReason: updater(set, "participantLeftReason"),
  setGeoData: updater(set, "geoData"),
}));

/**
 * Selector-aware access hook (backward compatible with the old Context API).
 *
 *  - `useMeetingAppContext(s => s.geoData)`  → subscribes to ONE slice (no extra re-renders)
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
