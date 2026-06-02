import { Popover, Transition } from "@headlessui/react";
import { CheckCircleIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Fragment, useEffect } from "react";
import DropMIC from "../icons/DropDown/DropMIC";
import { useMeetingAppContext } from "../context/MeetingAppContext";

export default function DropDownMic({
  mics,
  changeMic,
  micOn,
  volume = 0,
  didDeviceChange,
  setDidDeviceChange,
}) {
  const { selectedMicrophone, setSelectedMicroPhone, isMicrophonePermissionAllowed } =
    useMeetingAppContext((s) => ({
      selectedMicrophone: s.selectedMicrophone,
      setSelectedMicroPhone: s.setSelectedMicroPhone,
      isMicrophonePermissionAllowed: s.isMicrophonePermissionAllowed,
    }));

  useEffect(() => {
    if (didDeviceChange) setDidDeviceChange(false);
  }, [didDeviceChange]);

  return (
    <Popover className="relative w-full">
      {({ open }) => (
        <>
          <Popover.Button
            disabled={!isMicrophonePermissionAllowed}
            className="w-full flex items-center gap-1.5 px-2 py-[6px] bg-black/[0.02] border border-black/[0.05] rounded text-sm text-gray-900 focus:outline-none hover:bg-black/[0.05] transition-colors disabled:opacity-50"
          >
            <DropMIC fillColor="#6B7280" />
            <span className="flex-1 truncate text-left font-normal text-black">
              {isMicrophonePermissionAllowed
                ? (selectedMicrophone?.label || "Default microphone")
                : "Permission Needed"}
            </span>
            <ChevronUpDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
          </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel className="absolute bottom-full mb-1 z-20 min-w-full w-max">
              <div className="bg-[#e8e8e8] rounded-xl shadow-lg border border-black/10 overflow-hidden">
                <div className="flex flex-col py-1">
                  {mics.map((item, i) =>
                    item?.kind === "audioinput" ? (
                      <button
                        key={`mic_${i}`}
                        onClick={() => {
                          setSelectedMicroPhone({ label: item.label, id: item.deviceId });
                          changeMic(item.deviceId);
                        }}
                        className="flex items-center justify-between gap-6 px-4 py-2.5 text-sm text-gray-900 text-left hover:bg-black/5 transition-colors w-full whitespace-nowrap"
                      >
                        <span className="font-normal text-black">{item.label || `Mic ${i + 1}`}</span>
                        {selectedMicrophone?.label === item.label && (
                          <CheckCircleIcon className="w-5 h-5 text-black shrink-0" />
                        )}
                      </button>
                    ) : null
                  )}
                </div>
                <div className="border-t border-black/10 px-4 py-2.5 flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <div className="flex-1 bg-gray-400/40 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${(volume / 256) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
