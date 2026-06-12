/**
 * Central URL query param handling.
 *
 * The URL search string is immutable for the lifetime of a page load (the only
 * pathname rewrite — "/thank-you" on leave — happens long after parsing), so
 * params are parsed once at module load and exported as frozen constants.
 * Components import these directly; add new params here, never read
 * URLSearchParams ad-hoc in components.
 */

/** @typedef {"mer" | "ppmc"} Flow */
export const flows = {
  /** Full MER workflow: video call + sidebar + verification + backend. */
  MER: "mer",
  /** Bare doctor–patient video call. No sidebar, no backend calls. */
  PPMC: "ppmc",
};

const sp = new URLSearchParams(window.location.search);

const mode = (sp.get("mode") || "").toUpperCase();
const rawFlow = (sp.get("flow") || "").toLowerCase();

/**
 * @type {Readonly<{
 *   meetingId: string,
 *   mode: "DOCTOR" | "PATIENT" | string,
 *   role: "DOCTOR" | "CUSTOMER",
 *   caseId: string,
 *   token: string,
 *   participantId: string,
 *   meetingTitle: string,
 *   flow: Flow,
 * }>}
 */
export const appParams = Object.freeze({
  meetingId: sp.get("meetingId") || "",
  mode,
  role: mode === "DOCTOR" ? "DOCTOR" : "CUSTOMER",
  caseId: sp.get("caseId") || "",
  token: sp.get("token") || "",
  participantId: sp.get("participantId") || "",
  meetingTitle: sp.get("meetingTitle") || "",
  // Unknown/absent flow values fall back to PPMC.
  flow: rawFlow === flows.MER ? flows.MER : flows.PPMC,
});

/**
 * Per-flow feature gates. Components consume these flags instead of checking
 * `appParams.flow` inline.
 * @type {Readonly<{ showSidebar: boolean, enableBackend: boolean, enableVerification: boolean }>}
 */
const FLOW_CONFIGS = {
  [flows.MER]: {
    showSidebar: true,
    enableBackend: true,
    enableVerification: true,
    enableDisableLink: false,
    screenShare: "none",
    whiteboard: false,
  },
  [flows.PPMC]: {
    showSidebar: false,
    enableBackend: false,  // credentials fetched from URL token; disable-link uses its own fetch
    enableVerification: false,
    enableDisableLink: true,
    screenShare: "doctor", // "doctor" | "both" | "none"
    whiteboard: false,
  },
};

export const flowConfig = Object.freeze(FLOW_CONFIGS[appParams.flow]);

// ── Rejoin support ────────────────────────────────────────────────────────────
// Leaving a meeting rewrites the URL to "/thank-you", losing the query string.
// The search string is saved here on leave so the thank-you page can offer a
// rejoin link. sessionStorage keeps it per-tab and drops it when the tab closes.

const LAST_MEETING_SEARCH_KEY = "_vsdk_last_meeting_search";

export const saveLastMeetingSearch = () => {
  if (window.location.search) {
    sessionStorage.setItem(LAST_MEETING_SEARCH_KEY, window.location.search);
  }
};

export const getLastMeetingSearch = () =>
  sessionStorage.getItem(LAST_MEETING_SEARCH_KEY) || "";
