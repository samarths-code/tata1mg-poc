import React, { useEffect, useState } from "react";
import { MeetingProvider } from "@videosdk.live/react-sdk";
import { LeaveScreen } from "./components/screens/LeaveScreen";
import { JoiningScreen } from "./components/screens/JoiningScreen";
import { MeetingContainer } from "./meeting/MeetingContainer";
import { MeetingAppProvider } from "./context/MeetingAppContext";
import CreateMeetingPage from "./components/CreateMeetingPage";
import { getToken, getSessionCredentials } from "./api";

const App = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const urlMeetingId = searchParams.get("meetingId") || "";
  const urlMode = searchParams.get("mode") || "";
  const caseId = searchParams.get("caseId") || "";

  // Normalize: Doctor→DOCTOR, Patient→PATIENT→CUSTOMER, CUSTOMER→CUSTOMER
  const rawMode = urlMode.toUpperCase();
  const participantMode = rawMode === "PATIENT" ? "CUSTOMER" : rawMode || undefined;

  // When both meetingId and mode are in the URL, skip the manual join flow.
  const isAutoJoin = !!(urlMeetingId && urlMode);

  const defaultName = isAutoJoin
    ? urlMode.charAt(0).toUpperCase() + urlMode.slice(1).toLowerCase()
    : "";

  const [token, setToken] = useState("");
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
    if (isMobile) {
      window.onbeforeunload = () => "Are you sure you want to exit?";
    }
  }, [isMobile]);

  // Auto-fetch token + participantId when landing on a pre-shared link.
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

  return (
    <MeetingAppProvider
      initialMicOn={micOn}
      initialWebcamOn={webcamOn}
      initialSpeakerOn={speakerOn}
      participantMode={participantMode}
      caseId={caseId}
    >
      {isMeetingStarted ? (
        <MeetingProvider
          config={{
            meetingId,
            micEnabled: micOn,
            webcamEnabled: webcamOn,
            name: participantName || "Guest",
            participantId: participantId || undefined,
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
      ) : isMeetingLeft ? (
        <LeaveScreen setIsMeetingLeft={setIsMeetingLeft} />
      ) : (
        <JoiningScreen
          participantName={participantName}
          setParticipantName={setParticipantName}
          setMeetingId={setMeetingId}
          setToken={setToken}
          micEnabled={micOn}
          webcamEnabled={webcamOn}
          speakerEnabled={speakerOn}
          onClickStartMeeting={async () => {
            if (!token) {
              const tok = await getToken({ roomId: meetingId || undefined });
              setToken(tok);
            }
            setMeetingStarted(true);
          }}
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
  if (window.location.pathname === "/create-meeting") {
    return <CreateMeetingPage />;
  }
  return <App />;
};

export default AppRouter;
