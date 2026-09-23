import React, { useEffect, useState } from "react";
import { MeetingProvider } from "@videosdk.live/react-sdk";
import { LeaveScreen } from "./components/screens/LeaveScreen";
import { JoiningScreen } from "./components/screens/JoiningScreen";
import { MeetingContainer } from "./meeting/MeetingContainer";
import { MeetingAppProvider } from "./context/MeetingAppContext";
import { getToken, getSessionCredentials, getSessionParticipantId } from "./api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { releaseAllMedia } from "./lib/mediaTracks";

class MeetingErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("[MeetingErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 max-w-md w-full text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</p>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-450 hover:bg-orange-500 text-white px-6 py-2 rounded-xl font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const urlMeetingId    = searchParams.get("meetingId")    || "";
  const urlMode         = searchParams.get("mode")         || "";
  const caseId          = searchParams.get("caseId")       || "";
  const urlToken         = searchParams.get("token")         || "";
  const urlParticipantId = searchParams.get("participantId") || "";
  const urlMeetingTitle  = searchParams.get("meetingTitle")  || "";
  // Set by the create-meeting page. Audio-only calls never touch the camera.
  const isAudioOnly      = searchParams.get("callType") === "audio";

  const rawMode = urlMode.toUpperCase();
  const participantMode = rawMode === "PATIENT" ? "CUSTOMER" : rawMode || undefined;
  // When a token is supplied directly via the URL, skip the credentials API and
  // show the join form with the meeting ID pre-filled & locked (name stays editable).
  const isAutoJoin = !!(urlMeetingId && urlMode);
  // Set by the leave screen's REJOIN button — skip the join screen and drop
  // straight back into the meeting.
  const isRejoin = searchParams.get("rejoin") === "1";

  // Friendly default display name derived from role — never exposes the raw
  // mode value (Doctor/Patient) as the participant's name.
  const defaultName = rawMode
    ? (rawMode === "DOCTOR" ? "Doctor" : "Patient")
    : "";

  // Pre-populate token and participantId from URL when present (pre-auth flow).
  const [token, setToken]               = useState(urlToken);
  const [participantId, setParticipantId] = useState(urlParticipantId);
  const [meetingId, setMeetingId]       = useState(urlMeetingId);
  const [participantName, setParticipantName] = useState(defaultName);
  const [leaveScreenName, setLeaveScreenName] = useState(defaultName);
  const [micOn, setMicOn]               = useState(true);
  const [webcamOn, setWebcamOn]         = useState(!isAudioOnly);
  const [customAudioStream, setCustomAudioStream] = useState(null);
  const [customVideoStream, setCustomVideoStream] = useState(null);
  const [isMeetingStarted, setMeetingStarted]     = useState(false);
  const [isMeetingLeft, setIsMeetingLeft]         = useState(false);
  const [speakerOn, setSpekerOn]        = useState(true);
  const [credentialError, setCredentialError]     = useState("");
  const [isRejoining, setIsRejoining]             = useState(isRejoin);

  const isMobile = window.matchMedia("only screen and (max-width: 768px)").matches;

  // Closing/refreshing the tab mid-call: free camera + mic immediately.
  useEffect(() => {
    const onPageHide = () => { releaseAllMedia(); };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  // Mobile exit confirmation only while the call is live.
  useEffect(() => {
    if (!isMobile || !isMeetingStarted) return;
    window.onbeforeunload = () => "Are you sure you want to exit?";
    return () => { window.onbeforeunload = null; };
  }, [isMobile, isMeetingStarted]);

  useEffect(() => {
    // Skip backend call when token was embedded in the URL.
    if (!isAutoJoin || urlToken) return;

    getSessionCredentials({ meetingId: urlMeetingId, mode: rawMode })
      .then(({ token: tok, participantId: pid }) => {
        setToken(tok);
        setParticipantId(pid);
      })
      .catch((err) => {
        console.error("Failed to fetch session credentials:", err);
        setCredentialError("Unable to set up your session. Please check the link and try again.");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Rejoin flow: as soon as the token is ready, start the meeting directly
    // instead of showing the pre-call join screen.
    if (isRejoin && token && !isMeetingStarted) {
      setMeetingStarted(true);
    }
  }, [isRejoin, token, isMeetingStarted]);

  const handleStartMeeting = async () => {
    try {
      if (!token) {
        const tok = await getToken({ roomId: meetingId || undefined });
        setToken(tok);
      }
      setMeetingStarted(true);
    } catch (err) {
      console.error("Join error:", err);
      toast.error(
        err?.message?.includes("roomId")
          ? "Meeting ID is missing. Please check the link."
          : "Failed to join meeting. Check your connection and try again.",
        { position: "bottom-left", autoClose: 5000, hideProgressBar: true, closeButton: true, theme: "dark" }
      );
    }
  };

  // In-app rejoin (no page reload): restore the session from the preserved URL
  // params and go straight into the meeting, keeping the Thank You page as the
  // blurred backdrop behind the joining splash.
  const handleRejoin = () => {
    const sp = new URLSearchParams(window.location.search);
    const mId = sp.get("meetingId");
    if (!mId) return;
    // Drop /thank-you from the URL now that we're back in the session.
    window.history.replaceState(null, "", "/" + window.location.search);
    setIsRejoining(true);
    setIsMeetingLeft(false);
    setMeetingId(mId);
    setParticipantName((prev) => prev || leaveScreenName || defaultName);
    setMicOn(true);
    setWebcamOn(!isAudioOnly);
    setSpekerOn(true);
    // The previous session's custom tracks are now ended — drop them so the SDK
    // acquires fresh camera/mic tracks on rejoin (otherwise: error 3031).
    setCustomVideoStream(null);
    setCustomAudioStream(null);

    const urlTok = sp.get("token") || "";
    const urlPid = sp.get("participantId") || "";
    if (urlTok) {
      setToken(urlTok);
      setParticipantId(urlPid);
      setMeetingStarted(true);
    } else {
      // mode-only link — mint fresh credentials, then start.
      getSessionCredentials({ meetingId: mId, mode: (sp.get("mode") || "").toUpperCase() })
        .then(({ token: tok, participantId: pid }) => {
          setToken(tok);
          setParticipantId(pid);
          setMeetingStarted(true);
        })
        .catch((err) => {
          console.error("Rejoin failed:", err);
          setCredentialError("Unable to rejoin. Please try again.");
        });
    }
  };

  return (
    <MeetingAppProvider
      initialMicOn={micOn}
      initialWebcamOn={webcamOn}
      initialSpeakerOn={speakerOn}
      participantMode={participantMode}
      caseId={caseId}
      isAudioOnly={isAudioOnly}
    >
      {isMeetingLeft ? (
        <LeaveScreen participantName={leaveScreenName} onRejoin={handleRejoin} />
      ) : (
        <>
          {/* JoiningScreen stays mounted so WaitingToJoinScreen's backdrop-blur
              has the full white page to blur — wrapped non-interactive when meeting starts */}
          <div className={isMeetingStarted ? "fixed inset-0 pointer-events-none overflow-hidden" : ""}>
            {isRejoining ? (
              /* During rejoin the Thank You page is the blurred backdrop behind
                 the joining splash — not the pre-call join screen. */
              <LeaveScreen participantName={leaveScreenName} asBackground />
            ) : (
            <JoiningScreen
              participantName={participantName}
              setParticipantName={setParticipantName}
              setMeetingId={setMeetingId}
              setToken={setToken}
              micEnabled={micOn}
              webcamEnabled={webcamOn}
              speakerEnabled={speakerOn}
              onClickStartMeeting={handleStartMeeting}
              participantMode={participantMode}
              customAudioStream={customAudioStream}
              setCustomAudioStream={setCustomAudioStream}
              customVideoStream={customVideoStream}
              setCustomVideoStream={setCustomVideoStream}
              micOn={micOn}
              setMicOn={setMicOn}
              webcamOn={webcamOn}
              setSpekerOn={setSpekerOn}
              setWebcamOn={setWebcamOn}
              isAutoJoin={isAutoJoin}
              tokenReady={!!token}
              token={token}
              credentialError={credentialError}
              meetingTitle={urlMeetingTitle}
              isAudioOnly={isAudioOnly}
              permissionsReady
              inCall={isMeetingStarted}
            />
            )}
          </div>

          {isMeetingStarted && (
            <MeetingErrorBoundary>
              <MeetingProvider
                config={{
                  meetingId,
                  micEnabled: micOn,
                  webcamEnabled: webcamOn && !isAudioOnly,
                  name: participantName || "Guest",
                  participantId: participantId || (urlToken ? undefined : getSessionParticipantId()),
                  // Single layer, same as the 480p custom tracks — simulcast
                  // layers waste uplink in a 1:1 call on a weak network.
                  multiStream: false,
                  // All our tracks are VP8. With switching on, the SDK may
                  // replace the published custom track with a fresh camera
                  // (losing the exact pre-call track / virtual background).
                  codecSwitchEnabled: false,
                  customCameraVideoTrack: isAudioOnly ? undefined : customVideoStream,
                  customMicrophoneAudioTrack: customAudioStream,
                }}
                token={token}
                reinitialiseMeetingOnConfigChange={true}
                joinWithoutUserInteraction={true}
              >
                <MeetingContainer
                  precallTracks={{ video: !!customVideoStream && !isAudioOnly, audio: !!customAudioStream }}
                  onMeetingLeave={() => {
                    // Keep the original query params (meetingId/mode/token/…) so the
                    // leave screen can offer a Rejoin back into the same session.
                    window.history.replaceState(null, "", "/thank-you" + window.location.search);
                    setLeaveScreenName(participantName);
                    setToken("");
                    setParticipantId("");
                    setMeetingId("");
                    setParticipantName("");
                    setWebcamOn(false);
                    setMicOn(false);
                    // Already stopped by MeetingContainer — don't hand ended tracks to a rejoin.
                    setCustomAudioStream(null);
                    setCustomVideoStream(null);
                    setSpekerOn(false);
                    setMeetingStarted(false);
                    setIsMeetingLeft(true);
                  }}
                />
              </MeetingProvider>
            </MeetingErrorBoundary>
          )}
        </>
      )}
    </MeetingAppProvider>
  );
};

const ToastBar = () => (
  <ToastContainer
    toastClassName={() =>
      "relative flex items-center gap-3 py-3 px-4 rounded-xl overflow-hidden cursor-pointer " +
      "bg-[#1e2026] border border-white/[0.07] shadow-2xl"
    }
    bodyClassName={() => "text-white text-sm font-normal leading-5 flex-1"}
    position="bottom-left"
    autoClose={4000}
    hideProgressBar={false}
    progressClassName="bg-[#ff6f61] opacity-30 h-0.5"
    newestOnTop={false}
    closeButton={false}
    closeOnClick
    rtl={false}
    pauseOnFocusLoss
    draggable
    pauseOnHover
    theme="dark"
  />
);

const AppWithToasts = () => (
  <>
    <ToastBar />
    <App />
  </>
);

export default AppWithToasts;
