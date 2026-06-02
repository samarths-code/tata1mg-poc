import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useEffect, useRef } from "react";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import useMediaStream from "../hooks/useMediaStream";

const ResolutionListner = () => {
  const mMeeting = useMeeting();
  const { selectedWebcam, setWebCamResolution, webCamResolution } = useMeetingAppContext((s) => ({
    selectedWebcam: s.selectedWebcam,
    setWebCamResolution: s.setWebCamResolution,
    webCamResolution: s.webCamResolution,
  }));

  const selectedWebcamRef = useRef();
  const webCamResolutionRef = useRef();
  useEffect(() => { webCamResolutionRef.current = webCamResolution; }, [webCamResolution]);
  useEffect(() => { selectedWebcamRef.current = selectedWebcam; }, [selectedWebcam]);

  const { getVideoTrack } = useMediaStream();

  const { publish } = usePubSub(
    `CHANGE_RESOLUTION_${mMeeting?.localParticipant?.id}`,
    {
      onMessageReceived: async ({ payload }) => {
        try {
          const { resolutionValue } = payload;
          if (webCamResolutionRef.current === resolutionValue) return;

          setWebCamResolution(resolutionValue);
          const cam = selectedWebcamRef.current;
          if (!cam?.id) return;

          await mMeeting?.disableWebcam();
          const track = await getVideoTrack({ webcamId: cam.id, encoderConfig: resolutionValue });
          mMeeting.changeWebcam(track);
        } catch (err) {
          console.error("Error processing resolution change:", err);
        }
      },
    }
  );

  useEffect(() => {
    try {
      publish("change resolution", { persist: true }, { resolution: "sd", resolutionValue: "h480p_w640p" });
    } catch (err) {
      console.error("Error publishing initial resolution:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <></>;
};

export default ResolutionListner;
