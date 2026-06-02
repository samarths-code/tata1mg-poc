import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import { useEffect, useRef, useState } from "react";
import useMediaStream from "../hooks/useMediaStream";

const SwitchCameraListner = () => {
  const [webcams, setWebcams] = useState([]);
  const webcamsRef = useRef();
  useEffect(() => { webcamsRef.current = webcams; }, [webcams]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cams = devices.filter(
        (d) => d.kind === "videoinput" && d.deviceId !== "default" && d.deviceId !== "communications"
      );
      if (cams.length) setWebcams(cams);
    });
  }, []);

  const mMeeting = useMeeting();
  const setSelectedWebcam = useMeetingAppContext((s) => s.setSelectedWebcam);
  const { getVideoTrack } = useMediaStream();

  const { publish: publishDeviceInfo } = usePubSub("DEVICE_INFO", {});

  usePubSub(`SWITCH_PARTICIPANT_CAMERA_${mMeeting?.localParticipant?.id}`, {
    onMessageReceived: async ({ payload }) => {
      try {
        const { facingMode, isChangeWebcam, cameraDeviceId, cameraLabel } = payload;
        const target = cameraDeviceId
          ? webcamsRef.current.find((w) => w.deviceId === cameraDeviceId)
          : cameraLabel
          ? webcamsRef.current.find((w) => w.label === cameraLabel)
          : webcamsRef.current.find((w) => w.label.toLowerCase().includes(facingMode ?? ""));
        if (!target) return;

        setSelectedWebcam({ id: target.deviceId, label: target.label });
        if (isChangeWebcam) {
          mMeeting?.disableWebcam();
          const track = await getVideoTrack({ webcamId: target.deviceId });
          mMeeting.changeWebcam(track);
          // Notify InfoTab of the new active camera
          publishDeviceInfo("DEVICE_INFO", { persist: true }, { selectedCameraLabel: target.label });
        }
      } catch (err) {
        console.error("Error processing camera switch:", err);
      }
    },
  });

  return <></>;
};

export default SwitchCameraListner;
