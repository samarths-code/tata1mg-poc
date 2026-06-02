import React, { useEffect, useState } from "react";
import { MeetingProvider } from "@videosdk.live/react-sdk";
import { LeaveScreen } from "./components/screens/LeaveScreen";
import { JoiningScreen } from "./components/screens/JoiningScreen";
import { MeetingContainer } from "./meeting/MeetingContainer";
import { MeetingAppProvider } from "./context/MeetingAppContext";
import CreateMeetingPage from "./components/CreateMeetingPage";
import { getToken, getSessionCredentials, getSessionParticipantId } from "./api";
import { toast } from "react-toastify";

// Catches errors thrown by MeetingProvider / MeetingContainer so a crash
// shows an error screen instead of going blank white.
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
  const urlMeetingId = searchParams.get("meetingId") || "";
  const urlMode = searchParams.get("mode") || "";
  const caseId = searchParams.get("caseId") || "";
  const urlToken = searchParams.get("token") || "";

  const rawMode = urlMode.toUpperCase();
  const participantMode = rawMode === "PATIENT" ? "CUSTOMER" : rawMode || undefined;
  // When a token is supplied directly via the URL, skip the credentials API and
  // show the join form with the meeting ID pre-filled & locked (name stays editable).
  const isAutoJoin = !!(urlMeetingId && urlMode) && !urlToken;

  const defaultName = urlMode
    ? urlMode.charAt(0).toUpperCase() + urlMode.slice(1).toLowerCase()
    : "";

  const [token, setToken] = useState(urlToken);
  const [participantId, setParticipantId] = useState("");
  const [meetingId, setMeetingId] = useState(urlMeetingId);
  const [participantName, setParticipantName] = useState(defaultName);
  const [micOn, setMicOn] = useState(true);
  const [webcamOn, setWebcamOn] = useState(true);
  const [customAudioStream, setCustomAudioStream] = useState(null);
  const [customVideoStream, setCustomVideoStream] = useState(null);
  const [isMeetingStarted, setMeetingStarted] = useState(false);
  const [isMeetingLeft, setIsMeetingLeft] = useState(false);
  const [speakerOn, setSpekerOn] = useState(true);
  const [credentialError, setCredentialError] = useState("");

  const isMobile = window.matchMedia("only screen and (max-width: 768px)").matches;

  useEffect(() => {
    if (isMobile) window.onbeforeunload = () => "Are you sure you want to exit?";
  }, [isMobile]);

  useEffect(() => {
    if (!isAutoJoin) return;
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
        { position: "bottom-left", autoClose: 5000, hideProgressBar: true, closeButton: true, theme: "light" }
      );
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
      {isMeetingStarted ? (
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
                // Replace the tokened meeting URL with /thank-you so the client
                // can't Back/refresh into the ended session (removes it from history).
                window.history.replaceState(null, "", "/thank-you");
                setToken("");
                setParticipantId("");
                setMeetingId("");
                setWebcamOn(false);
                setMicOn(false);
                setSpekerOn(false);
                setMeetingStarted(false);
                setIsMeetingLeft(true);
              }}
            />
          </MeetingProvider>
        </MeetingErrorBoundary>
      ) : isMeetingLeft ? (
        <LeaveScreen participantName={participantName} />
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
          credentialError={credentialError}
        />
      )}
    </MeetingAppProvider>
  );
};

const AppRouter = () => {
  const path = window.location.pathname;
  if (path === "/create-meeting") return <CreateMeetingPage />;
  // Standalone Thank-You route — shown after a meeting ends and on refresh of
  // /thank-you, instead of falling back into the join flow.
  if (path === "/thank-you")
    return <LeaveScreen setIsMeetingLeft={() => { window.location.href = "/"; }} />;
  return <App />;
};

export default AppRouter;
