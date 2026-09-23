import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { XMarkIcon, ArrowDownTrayIcon, ArrowPathIcon, ScissorsIcon } from "@heroicons/react/24/outline";
import Pill from "../buttons/Pill";
import { IMAGE_TRANSFER_TOPIC, captureTopic } from "../ImageUploadListner";

// Crop / resize / rotate editor — cropperjs is only downloaded when opened.
const PhotoEditModal = lazy(() => import(/* webpackChunkName: "photo-editor" */ "../PhotoEditModal"));

// No chunks within this window → assume the client couldn't capture.
const CAPTURE_TIMEOUT_MS = 20000;

const CameraSnapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Agent-only: grabs a still frame from the client's camera. The client sends it
// back in chunks over pubsub (see ImageUploadListner); we reassemble it here.
export default function ImageCaptureButton({ customerId }) {
  const { localParticipant } = useMeeting();
  const [state, setState] = useState(null); // null | { status: "loading"|"done"|"error", progress, image }
  const [editing, setEditing] = useState(false);
  const chunksRef = useRef({ id: null, parts: [], received: 0 });
  const timeoutRef = useRef(null);

  const { publish: requestCapture } = usePubSub(captureTopic(customerId ?? "__none__"), {});

  usePubSub(
    IMAGE_TRANSFER_TOPIC,
    {
      onMessageReceived: ({ payload, senderId }) => {
        if (senderId === localParticipant?.id || !payload) return;
        clearTimeout(timeoutRef.current);
        if (payload.error) {
          setState({ status: "error" });
          return;
        }
        const { id, index, totalChunk, chunkdata } = payload;
        const buf = chunksRef.current;
        if (buf.id !== id) chunksRef.current = { id, parts: new Array(totalChunk), received: 0 };
        const cur = chunksRef.current;
        if (cur.parts[index] == null) {
          cur.parts[index] = chunkdata;
          cur.received += 1;
        }
        if (cur.received === totalChunk) {
          setState({ status: "done", image: `data:image/jpeg;base64,${cur.parts.join("")}` });
          chunksRef.current = { id: null, parts: [], received: 0 };
        } else {
          setState({ status: "loading", progress: Math.round((cur.received / totalChunk) * 100) });
        }
      },
    }
  );

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function capture() {
    if (!customerId) return;
    chunksRef.current = { id: null, parts: [], received: 0 };
    setState({ status: "loading", progress: 0 });
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setState({ status: "error" }), CAPTURE_TIMEOUT_MS);
    try {
      requestCapture("IMAGE_CAPTURE", { persist: false }, { senderId: localParticipant?.id });
    } catch (err) {
      console.error("Capture trigger error:", err);
      setState({ status: "error" });
    }
  }

  function close() {
    clearTimeout(timeoutRef.current);
    setEditing(false);
    setState(null);
  }

  function download() {
    const a = document.createElement("a");
    a.href = state.image;
    a.download = `patient-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    a.click();
  }

  return (
    <>
      <Pill>
        <button
          onClick={capture}
          disabled={!customerId || state?.status === "loading"}
          title={customerId ? "Capture patient image" : "Patient not connected"}
          aria-label="Capture patient image"
          className="flex items-center justify-center p-1 rounded shrink-0 disabled:opacity-40"
        >
          <CameraSnapIcon />
        </button>
      </Pill>

      {state && !editing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={state.status === "loading" ? undefined : close} />
          <div className="relative bg-[#101113] border border-white/5 rounded-[24px] w-[560px] max-w-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-white text-lg font-semibold">Captured Image</h2>
              <button onClick={close} aria-label="Close" className="p-1 text-[#919093] hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pb-4">
              <div className="rounded-xl bg-[#1b1b1e] border border-white/5 min-h-[220px] flex items-center justify-center overflow-hidden">
                {state.status === "done" ? (
                  <img src={state.image} alt="Patient capture" className="max-h-[60vh] w-full object-contain" />
                ) : state.status === "error" ? (
                  <p className="text-[#fecaca] text-sm text-center px-6">
                    Couldn't capture the image. Make sure the patient's camera is on, then try again.
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-3 w-2/3">
                    <p className="text-[#919093] text-sm">Receiving image… {state.progress || 0}%</p>
                    <div className="h-1 w-full rounded bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#ff6f61] transition-all" style={{ width: `${state.progress || 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.03]">
              <button
                onClick={capture}
                disabled={state.status === "loading"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-[#303033] hover:bg-[#3a3a3d] disabled:opacity-40"
              >
                <ArrowPathIcon className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={() => setEditing(true)}
                disabled={state.status !== "done"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-[#303033] hover:bg-[#3a3a3d] disabled:opacity-40"
              >
                <ScissorsIcon className="w-4 h-4" /> Crop &amp; Resize
              </button>
              <button
                onClick={download}
                disabled={state.status !== "done"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#ff6f61] hover:bg-[#e85e51] disabled:opacity-40"
              >
                <ArrowDownTrayIcon className="w-4 h-4" /> Download
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && state?.image && (
        <Suspense fallback={null}>
          <PhotoEditModal
            open
            title="Crop & Resize"
            imageSrc={state.image}
            onClose={() => setEditing(false)}
            onRetake={() => { setEditing(false); capture(); }}
            onSave={(edited) => {
              setState({ status: "done", image: edited });
              setEditing(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
