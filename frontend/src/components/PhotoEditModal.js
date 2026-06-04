import React, { useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { Cropper } from "react-cropper";
import "cropperjs/dist/cropper.css";
import { XMarkIcon } from "@heroicons/react/24/outline";

function RotateLeftIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c2.62 0 4.978 1.007 6.745 2.646M21.542 12C20.268 16.057 16.477 19 12 19c-2.62 0-4.978-1.007-6.745-2.646" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 9l.458 3 3-.458" />
    </svg>
  );
}

function RotateRightIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.542 12C20.268 7.943 16.477 5 12 5c-2.62 0-4.978 1.007-6.745 2.646M2.458 12C3.732 16.057 7.523 19 12 19c2.62 0 4.978-1.007 6.745-2.646" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 9l-.458 3-3-.458" />
    </svg>
  );
}

export default function PhotoEditModal({ open, onClose, imageSrc, onSave, onRetake, title = "Edit Photo" }) {
  const [cropper, setCropper] = useState(null);

  const rotate = (deg) => {
    if (cropper) cropper.rotate(deg);
  };

  const handleSave = () => {
    if (!imageSrc) return;
    if (cropper) {
      const canvas = cropper.getCroppedCanvas({ imageSmoothingQuality: "high" });
      if (canvas) {
        onSave(canvas.toDataURL("image/jpeg", 0.92));
        return;
      }
    }
    onSave(imageSrc);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        {/* p-3 on mobile so panel stays edge-friendly but centered; p-4 on sm+ */}
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel
              className="w-full sm:max-w-2xl flex flex-col overflow-hidden shadow-2xl rounded-2xl"
              style={{ maxHeight: "calc(100dvh - 24px)", background: "#1A1C22" }}
            >

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
                style={{ borderColor: "#232830" }}>
                <Dialog.Title className="text-sm font-semibold text-white">{title}</Dialog.Title>
                <button
                  onClick={handleClose}
                  className="rounded-lg p-1.5 transition-colors text-[#919093] hover:text-white hover:bg-[#303033]"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Cropper — fills remaining height */}
              <div className="flex-1 min-h-0 overflow-hidden p-3" style={{ background: "#050A0E", minHeight: 280 }}>
                {imageSrc ? (
                  <Cropper
                    src={imageSrc}
                    style={{ height: "100%", width: "100%", minHeight: 260 }}
                    viewMode={1}
                    autoCropArea={0.85}
                    background={false}
                    responsive={true}
                    checkOrientation={false}
                    onInitialized={(instance) => setCropper(instance)}
                    guides={true}
                    dragMode="move"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-[#919093] text-sm">
                    No image loaded
                  </div>
                )}
              </div>

              {/* Toolbar — two rows on mobile so nothing overflows */}
              <div className="shrink-0 px-4 py-3 border-t" style={{ background: "#232830", borderColor: "#2e3540" }}>
                {/* Row 1: secondary actions */}
                <div className="flex items-center gap-2 mb-2">
                  {onRetake && (
                    <button
                      onClick={() => { onClose(); onRetake(); }}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-white transition-colors"
                      style={{ background: "#1A1C22" }}
                    >
                      Retake
                    </button>
                  )}
                  <button
                    onClick={() => rotate(-90)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-white transition-colors"
                    style={{ background: "#1A1C22" }}
                  >
                    <RotateLeftIcon /><span>Left</span>
                  </button>
                  <button
                    onClick={() => rotate(90)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-white transition-colors"
                    style={{ background: "#1A1C22" }}
                  >
                    <RotateRightIcon /><span>Right</span>
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm rounded-lg text-[#919093] hover:text-white transition-colors ml-auto"
                  >
                    Cancel
                  </button>
                </div>
                {/* Row 2: primary action — full width on mobile */}
                <button
                  onClick={handleSave}
                  disabled={!imageSrc}
                  className="w-full py-2.5 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-40"
                  style={{ background: "#FF6F61" }}
                >
                  Save & Use
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
