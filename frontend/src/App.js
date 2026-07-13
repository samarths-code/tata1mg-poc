import React, { useEffect, useState } from "react";
import { MeetingProvider } from "@videosdk.live/react-sdk";
import { LeaveScreen } from "./components/screens/LeaveScreen";
import { JoiningScreen } from "./components/screens/JoiningScreen";
import { MeetingContainer } from "./meeting/MeetingContainer";
import { MeetingAppProvider } from "./context/MeetingAppContext";
import CreateMeetingPage from "./components/CreateMeetingPage";
import { getToken, getSessionCredentials, getSessionParticipantId } from "./api";
import { toast } from "react-toastify";

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
    ? (rawMode === "DOCTOR" ? "Agent" : "Client")
    : "";

  // Pre-populate token and participantId from URL when present (pre-auth flow).
  const [token, setToken]               = useState(urlToken);
  const [participantId, setParticipantId] = useState(urlParticipantId);
  const [meetingId, setMeetingId]       = useState(urlMeetingId);
  const [participantName, setParticipantName] = useState(defaultName);
  const [leaveScreenName, setLeaveScreenName] = useState(defaultName);
  const [micOn, setMicOn]               = useState(true);
  const [webcamOn, setWebcamOn]         = useState(true);
  const [customAudioStream, setCustomAudioStream] = useState(null);
  const [customVideoStream, setCustomVideoStream] = useState(null);
  const [isMeetingStarted, setMeetingStarted]     = useState(false);
  const [isMeetingLeft, setIsMeetingLeft]         = useState(false);
  const [speakerOn, setSpekerOn]        = useState(true);
  const [credentialError, setCredentialError]     = useState("");
  const [isRejoining, setIsRejoining]             = useState(isRejoin);

  const isMobile = window.matchMedia("only screen and (max-width: 768px)").matches;

  useEffect(() => {
    if (isMobile) window.onbeforeunload = () => "Are you sure you want to exit?";
  }, [isMobile]);

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
    setIsRejoining(true);
    setIsMeetingLeft(false);
    setMeetingId(mId);
    setParticipantName((prev) => prev || leaveScreenName || defaultName);
    setMicOn(true);
    setWebcamOn(true);
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
            />
            )}
          </div>

          {isMeetingStarted && (
            <MeetingErrorBoundary>
              <MeetingProvider
                config={{
                  meetingId,
                  micEnabled: micOn,
                  webcamEnabled: webcamOn,
                  name: participantName || "Guest",
                  participantId: participantId || (urlToken ? undefined : getSessionParticipantId()),
                  multiStream: true,
                  customCameraVideoTrack: customVideoStream,
                  customMicrophoneAudioTrack: customAudioStream,
                }}
                token={token}
                reinitialiseMeetingOnConfigChange={true}
                joinWithoutUserInteraction={true}
              >
                <MeetingContainer
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

const AppRouter = () => {
  const path = window.location.pathname;
  if (path === "/create-meeting") return <CreateMeetingPage />;
  if (path === "/thank-you")
    return <LeaveScreen setIsMeetingLeft={() => { window.location.href = "/"; }} />;

  // Only show the joining flow when both meetingId and mode are present in the URL.
  // Any other visit to "/" (direct, bookmark, no params) shows the create-meeting page.
  const sp = new URLSearchParams(window.location.search);
  if (!sp.get("meetingId") || !sp.get("mode")) return <CreateMeetingPage />;

  return <App />;
};

export default AppRouter;
