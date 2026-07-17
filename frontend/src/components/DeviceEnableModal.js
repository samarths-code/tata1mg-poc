import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

const DEVICE_CONFIG = {
  mic: {
    title: "Enable Microphone",
    description:
      "Allow microphone access so others can hear you in the meeting. You can mute yourself anytime.",
    buttonLabel: "Enable Microphone",
  },
  camera: {
    title: "Enable Camera",
    description:
      "Allow camera access so others can see you during the Application. You can turn it off anytime.",
    buttonLabel: "Enable Camera",
  },
  speaker: {
    title: "Enable Speaker",
    description:
      "Allow speaker access so you can hear other participants in the meeting.",
    buttonLabel: "Enable Speaker",
  },
};

export default function DeviceEnableModal({ device, onClose, onEnable }) {
  if (!device) return null;
  const { title, description, buttonLabel } = DEVICE_CONFIG[device] || DEVICE_CONFIG.mic;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm px-4">
      {/* Card — 350px on mobile, 500px on desktop (Figma) */}
      <div className="bg-white rounded-[24px] border border-[rgba(0,0,0,0.1)] w-full max-w-[500px] flex flex-col shadow-2xl">

        {/* Header — p-5 (20px) all sides matching Figma */}
        <div className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between gap-2.5">
            <h2 className="flex-1 text-[18px] font-semibold text-black leading-[26px]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center p-1 rounded-md text-[#919093] hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[12px] text-[#919093] leading-4">{description}</p>
        </div>

        {/* Footer — p-5 (20px) all sides; top padding creates proper gap from description */}
        <div className="p-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-black bg-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.08)] transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={() => { onEnable(); onClose(); }}
            className="px-3 py-1.5 rounded text-sm font-medium text-white bg-[#ff6f61] hover:bg-[#e85e51] transition-colors"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
