import { useMeeting, useParticipant, usePubSub } from "@videosdk.live/react-sdk";
import { useEffect, useRef } from "react";

const CHUNK_SIZE = 500;

const ImageUploadListner = () => {
  const mMeeting = useMeeting();
  const { captureImage, webcamStream } = useParticipant(mMeeting?.localParticipant?.id);
  const webcamStreamRef = useRef();
  useEffect(() => { webcamStreamRef.current = webcamStream; }, [webcamStream]);

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
          captureAndChunk();
        }
      } catch (err) {
        console.error("Error on IMAGE_CAPTURE:", err);
      }
    },
  });

  return <></>;
};

export default ImageUploadListner;
