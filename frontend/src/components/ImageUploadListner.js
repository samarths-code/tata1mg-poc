import { useMeeting, useParticipant, usePubSub } from "@videosdk.live/react-sdk";
import useSafePublish from "../hooks/useSafePublish";

const CHUNK_SIZE = 500;

export const IMAGE_TRANSFER_TOPIC = "IMAGE_TRANSFER";
export const captureTopic = (participantId) => `IMAGE_CAPTURE_${participantId}`;

// Client side of the agent's "capture image" button: grabs a frame from the
// local camera and streams it back in chunks. Chunks are not persisted — the
// server doesn't need to store (and replay to rejoiners) a one-off image.
const ImageUploadListner = () => {
  const mMeeting = useMeeting();
  const localId = mMeeting?.localParticipant?.id;
  const { captureImage } = useParticipant(localId);

  const { publish: publishChunk } = useSafePublish(IMAGE_TRANSFER_TOPIC, {});

  async function captureAndChunk() {
    const transferId = Math.random().toString(36).substring(2, 9);
    let base64Data = null;
    try {
      base64Data = await captureImage();
    } catch (err) {
      console.error("Error capturing image:", err);
    }
    if (!base64Data) {
      // Camera off / no frame — tell the agent instead of letting it time out.
      try { publishChunk("CHUNK", { persist: false }, { id: transferId, error: true }); } catch (e) { /* noop */ }
      return;
    }

    const totalChunk = Math.ceil(base64Data.length / CHUNK_SIZE);
    for (let i = 0; i < totalChunk; i++) {
      try {
        publishChunk("CHUNK", { persist: false }, {
          id: transferId,
          index: i,
          totalChunk,
          chunkdata: base64Data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        });
        await new Promise((r) => setTimeout(r, 5));
      } catch (err) {
        console.error(`Error sending chunk ${i}:`, err);
      }
    }
  }

  usePubSub(captureTopic(localId), {
    onMessageReceived: ({ payload }) => {
      if (payload?.senderId !== localId) captureAndChunk();
    },
  });

  return null;
};

export default ImageUploadListner;
