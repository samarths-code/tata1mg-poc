import { useMeeting, useParticipant, usePubSub } from "@videosdk.live/react-sdk";
import { useEffect, useRef, useState } from "react";
import PatientCaptureOverlay from "./PatientCaptureOverlay";

const CHUNK_SIZE = 500;

// Map the doctor's capture target to the patient-facing overlay variant.
// `reference` is a silent background grab — no overlay.
function variantForTarget(target) {
  if (target === "reference") return null;
  if (target === "customerPhoto") return "face";
  return "document"; // aadhaarFront / aadhaarBack
}

const ImageUploadListner = () => {
  const mMeeting = useMeeting();
  const { captureImage, webcamStream } = useParticipant(mMeeting?.localParticipant?.id);
  const webcamStreamRef = useRef();
  useEffect(() => { webcamStreamRef.current = webcamStream; }, [webcamStream]);

  const [overlayVariant, setOverlayVariant] = useState(null);
  const overlayTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(overlayTimerRef.current), []);

  const { publish: publishChunk } = usePubSub("IMAGE_TRANSFER", {});

  const splitIntoChunks = (str, size) => {
    const chunks = [];
    let i = 0;
    while (i < str.length) {
      chunks.push(str.substring(i, i + size));
      i += size;
    }
    return chunks;
  };

  async function captureAndChunk() {
    try {
      const base64Data = await captureImage();
      const chunks = splitIntoChunks(base64Data, CHUNK_SIZE);
      const transferId = Math.random().toString(36).substring(2, 9);

      for (let i = 0; i < chunks.length; i++) {
        try {
          publishChunk("CHUNK", { persist: true }, {
            id: transferId,
            index: i,
            totalChunk: chunks.length,
            chunkdata: chunks[i],
          });
          await new Promise((r) => setTimeout(r, 5));
        } catch (err) {
          console.error(`Error sending chunk ${i}:`, err);
        }
      }
    } catch (err) {
      console.error("Error capturing image:", err);
    }
  }

  usePubSub(`IMAGE_CAPTURE_${mMeeting?.localParticipant?.id}`, {
    onMessageReceived: ({ payload }) => {
      try {
        if (payload.senderId !== mMeeting?.localParticipant?.id) {
          const variant = variantForTarget(payload.target);
          if (variant) {
            setOverlayVariant(variant);
            clearTimeout(overlayTimerRef.current);
            overlayTimerRef.current = setTimeout(() => setOverlayVariant(null), 1800);
          }
          captureAndChunk();
        }
      } catch (err) {
        console.error("Error on IMAGE_CAPTURE:", err);
      }
    },
  });

  return overlayVariant ? <PatientCaptureOverlay variant={overlayVariant} /> : null;
};

export default ImageUploadListner;
