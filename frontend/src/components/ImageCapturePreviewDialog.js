import { Dialog, Transition } from "@headlessui/react";
import React, { Fragment, useState, useRef } from "react";
import { Cropper } from "react-cropper";
import "cropperjs/dist/cropper.css";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import { toast } from "react-toastify";
import useIsMobile from "../hooks/useIsMobile";

const ImageCapturePreviewDialog = ({ open, setOpen }) => {
  const mMeeting = useMeeting();
  const [imageSrc, setImageSrc] = useState(null);
  const { setCustomerPhoto, setAadhaarPhoto } = useMeetingAppContext();
  const isMobile = useIsMobile();
  const imageChunksRef = useRef({});

  usePubSub("IMAGE_TRANSFER", {
    onMessageReceived: ({ payload, senderId }) => {
      if (senderId === mMeeting.localParticipant.id) return;
      try {
        const { id, index, totalChunk, chunkdata } = payload;
        if (!imageChunksRef.current[id]) imageChunksRef.current[id] = [];
        imageChunksRef.current[id][index] = { index, chunkdata };

        if (imageChunksRef.current[id].length === totalChunk) {
          const base64 = imageChunksRef.current[id]
            .sort((a, b) => a.index - b.index)
            .map((c) => c.chunkdata)
            .join("");
          setImageSrc(`data:image/jpeg;base64,${base64}`);
          delete imageChunksRef.current[id];
        }
      } catch (err) {
        console.error("Error reassembling image chunks:", err);
      }
    },
  });

  const [cropData, setCropData] = useState(null);
  const [cropper, setCropper] = useState();
  const [cropClicked, setCropClicked] = useState(false);

  const getCropData = () => {
    if (cropper) setCropData(cropper.getCroppedCanvas().toDataURL());
  };

  const finalImage = cropClicked && cropData ? cropData : imageSrc;

  const handleSave = (saveAs) => {
    if (!finalImage) { toast.error("No image to save."); return; }
    if (saveAs === "photo") {
      setCustomerPhoto(finalImage);
      toast.success("Customer photo saved.", { autoClose: 2000 });
    } else {
      setAadhaarPhoto(finalImage);
      toast.success("Aadhaar card saved.", { autoClose: 2000 });
    }
    setOpen(false);
    setImageSrc(null);
    setCropData(null);
    setCropClicked(false);
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => { if (isMobile) setOpen(false); }}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel
                style={{ maxHeight: "calc(100vh - 150px)" }}
                className={`${isMobile ? "w-11/12" : "w-9/12"} transform relative overflow-y-auto rounded bg-gray-750 p-4 text-left align-middle flex flex-col items-center shadow-xl transition-all`}
              >
                <Dialog.Title className="text-base font-medium text-white w-full">
                  Capture Preview
                </Dialog.Title>

                <div className={`flex ${isMobile ? "flex-col" : "mt-8"} items-center justify-center h-full w-full`}>
                  {imageSrc ? (
                    <img src={imageSrc} width={isMobile ? "100%" : "38%"} height="auto" alt="Captured" className={isMobile ? "object-contain" : ""} />
                  ) : (
                    <p className="text-white text-center">Waiting for image...</p>
                  )}
                  <Cropper
                    style={{ width: isMobile ? "100%" : "38%", height: "auto", objectFit: "contain", marginLeft: isMobile ? 0 : "1rem", marginTop: isMobile ? "1rem" : 0 }}
                    zoomTo={0.5}
                    initialAspectRatio={1}
                    preview=".img-preview"
                    src={imageSrc}
                    viewMode={1}
                    minCropBoxHeight={10}
                    minCropBoxWidth={10}
                    background={false}
                    responsive={true}
                    autoCropArea={1}
                    checkOrientation={false}
                    onInitialized={(instance) => setCropper(instance)}
                    guides={true}
                    crossOrigin="anonymous"
                  />
                </div>

                <div className="flex items-end justify-end w-full mt-6">
                  <button className="bg-white text-black px-3 py-2 rounded text-sm" onClick={() => { setCropClicked(true); getCropData(); }}>
                    Crop
                  </button>
                </div>

                {cropClicked && cropData && (
                  <div className={`flex flex-col justify-center items-center ${isMobile ? "w-full" : "max-w-[60%]"} mt-3`}>
                    <span className="text-white font-semibold text-sm">After Crop</span>
                    <img className={`object-contain mt-2 ${isMobile ? "w-full" : "h-[300px]"}`} src={cropData} alt="cropped" />
                  </div>
                )}

                <div className="mt-6 flex w-full justify-end gap-3 flex-wrap">
                  <button type="button" className="rounded border border-white bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-gray-700" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" disabled={!imageSrc} className="rounded border border-blue-400 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40" onClick={() => handleSave("photo")}>
                    Save as Photo
                  </button>
                  <button type="button" disabled={!imageSrc} className="rounded border border-green-400 bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40" onClick={() => handleSave("aadhaar")}>
                    Save as Aadhaar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ImageCapturePreviewDialog;
