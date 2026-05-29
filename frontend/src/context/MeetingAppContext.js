import { createContext, useContext, useEffect, useState } from "react";
import { VirtualBackgroundProcessor } from "@videosdk.live/videosdk-media-processor-web";
import { participantModes } from "../utils/common";
import useIsMobile from "../hooks/useIsMobile";

export const MeetingAppContext = createContext();

export const useMeetingAppContext = () => useContext(MeetingAppContext);

export const MeetingAppProvider = ({
  children,
  initialMicOn,
  initialWebcamOn,
  participantMode,
  initialSpeakerOn,
  caseId,
}) => {
  const isMobile = useIsMobile();

  const [sideBarMode, setSideBarMode] = useState(null);

  const [selectedMicrophone, setSelectedMicroPhone] = useState({ id: null, label: null });
  const [selectedMicDevice, setSelectedMicDevice] = useState(selectedMicrophone);
  const [selectedWebcam, setSelectedWebcam] = useState({ id: null, label: null });
  const [selectedSpeaker, setSelectedSpeaker] = useState({ id: null, label: null });

  const [isCameraPermissionAllowed, setIsCameraPermissionAllowed] = useState(null);
  const [isMicrophonePermissionAllowed, setIsMicrophonePermissionAllowed] = useState(null);

  const [raisedHandsParticipants, setRaisedHandsParticipants] = useState([]);
  const [useVirtualBackground, setUseVirtualBackground] = useState(false);
  const [webCamResolution, setWebCamResolution] = useState("h480p_w640p");
  const [participantLeftReason, setParticipantLeftReason] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState({ facingMode: "front" });
  const [meetingMode, setMeetingMode] = useState(null);
  const [muteSpeaker, setMuteSpeaker] = useState(initialSpeakerOn);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState(selectedMicrophone);

  // Standard images array (for IMAGE_PANEL sidebar compatibility)
  const [images, setImages] = useState([]);

  // MER-specific captured data
  const [geoData, setGeoData] = useState(null);           // { latitude, longitude, timestamp }
  const [customerPhoto, setCustomerPhoto] = useState(null); // base64 data URL string
  const [aadhaarPhoto, setAadhaarPhoto] = useState(null);   // base64 data URL string
  const [submissionStatus, setSubmissionStatus] = useState("idle"); // idle | submitting | success | error

  // Vision AI
  const [referencePhoto, setReferencePhoto] = useState(null); // base64 for face-match reference
  const [customerSpoofStatus, setCustomerSpoofStatus] = useState(null); // null | 'checking' | 'real' | 'spoof'

  const videoProcessor = new VirtualBackgroundProcessor();

  const isDoctor =
    participantMode === participantModes.DOCTOR ||
    participantMode === participantModes.AGENT;

  useEffect(() => {
    setMuteSpeaker(initialSpeakerOn);
  }, [initialSpeakerOn]);

  return (
    <MeetingAppContext.Provider
      value={{
        initialMicOn,
        initialWebcamOn,
        participantMode,
        caseId,

        allowedVirtualBackground: false,
        maintainVideoAspectRatio: isDoctor,
        maintainLandscapeVideoAspectRatio: true,
        canRemoveOtherParticipant: isDoctor,

        sideBarMode,
        selectedWebcam,
        selectedMicrophone,
        selectedMicDevice,
        raisedHandsParticipants,
        useVirtualBackground,
        participantLeftReason,
        meetingMode,
        muteSpeaker,
        selectedOutputDevice,
        webCamResolution,
        cameraFacingMode,
        selectedSpeaker,
        isCameraPermissionAllowed,
        isMicrophonePermissionAllowed,
        images,

        // MER captured data
        geoData,
        customerPhoto,
        aadhaarPhoto,
        submissionStatus,
        referencePhoto,
        customerSpoofStatus,

        setSideBarMode,
        setRaisedHandsParticipants,
        setUseVirtualBackground,
        setParticipantLeftReason,
        setMeetingMode,
        setMuteSpeaker,
        setSelectedOutputDevice,
        setWebCamResolution,
        setCameraFacingMode,
        setSelectedWebcam,
        setSelectedSpeaker,
        setIsCameraPermissionAllowed,
        setIsMicrophonePermissionAllowed,
        setSelectedMicroPhone,
        setSelectedMicDevice,
        setImages,

        // MER setters
        setGeoData,
        setCustomerPhoto,
        setAadhaarPhoto,
        setSubmissionStatus,

        // Vision AI
        referencePhoto,
        setReferencePhoto,
        customerSpoofStatus,
        setCustomerSpoofStatus,

        videoProcessor,
      }}
    >
      {children}
    </MeetingAppContext.Provider>
  );
};
