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

export default function PhotoEditModal({ open, onClose, imageSrc, onSave, title = "Edit Photo" }) {
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

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden shadow-2xl"
              style={{ maxHeight: "calc(100vh - 48px)", background: "#1A1C22" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
                style={{ borderColor: "#232830" }}>
                <Dialog.Title className="text-sm font-semibold text-white">{title}</Dialog.Title>
                <button
                  onClick={handleClose}
                  className="rounded-lg p-1.5 transition-colors text-gray-900 hover:text-white hover:bg-gray-700"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Cropper */}
              <div className="flex-1 min-h-0 overflow-hidden p-3" style={{ background: "#050A0E" }}>
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
                  <div className="h-64 flex items-center justify-center text-gray-900 text-sm">
                    No image loaded
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0 border-t gap-3"
                style={{ background: "#232830", borderColor: "#232830" }}>
                <div className="flex gap-2">
                  <button
                    onClick={() => rotate(-90)}
                    title="Rotate left 90°"
                    className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-white transition-colors"
                    style={{ background: "#1A1C22" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#404B53")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#1A1C22")}
                  >
                    <RotateLeftIcon />
                    <span>Left</span>
                  </button>
                  <button
                    onClick={() => rotate(90)}
                    title="Rotate right 90°"
                    className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-white transition-colors"
                    style={{ background: "#1A1C22" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#404B53")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#1A1C22")}
                  >
                    <RotateRightIcon />
                    <span>Right</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm rounded-lg transition-colors text-gray-900 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!imageSrc}
                    className="px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-40"
                    style={{ background: "#FF6F61" }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = "#E85A4F")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#FF6F61")}
                  >
                    Save & Use
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
