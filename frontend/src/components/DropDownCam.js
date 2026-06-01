import { Popover, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";
import DropCAM from "../icons/DropDown/DropCAM";
import { useMeetingAppContext } from "../context/MeetingAppContext";

export default function DropDownCam({ webcams, changeWebcam }) {
  const { setSelectedWebcam, selectedWebcam, isCameraPermissionAllowed } =
    useMeetingAppContext();

  return (
    <Popover className="relative w-full">
      {({ open }) => (
        <>
          <Popover.Button
            disabled={!isCameraPermissionAllowed}
            className="w-full flex items-center gap-1.5 px-2 py-[6px] bg-black/[0.02] border border-black/[0.05] rounded text-sm text-gray-900 focus:outline-none hover:bg-black/[0.05] transition-colors disabled:opacity-50"
          >
            <DropCAM fillColor="#6B7280" />
            <span className="flex-1 truncate text-left font-normal">
              {isCameraPermissionAllowed
                ? (selectedWebcam?.label || "Default camera")
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
            <Popover.Panel className="absolute bottom-full mb-1 z-10 w-full min-w-[180px]">
              <div className="bg-gray-900 rounded-lg shadow-xl border border-white/10 overflow-hidden">
                <div className="flex flex-col py-1">
                  {webcams.map((item, i) =>
                    item?.kind === "videoinput" ? (
                      <button
                        key={`cam_${i}`}
                        onClick={() => {
                          setSelectedWebcam({ id: item.deviceId, label: item.label });
                          changeWebcam(item.deviceId);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-white text-left hover:bg-white/10 transition-colors w-full"
                      >
                        <span className="w-4 shrink-0">
                          {selectedWebcam?.label === item.label && (
                            <CheckIcon className="w-4 h-4 text-orange-400" />
                          )}
                        </span>
                        <span className="truncate">{item.label || `Camera ${i + 1}`}</span>
                      </button>
                    ) : null
                  )}
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
