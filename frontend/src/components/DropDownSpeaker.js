import { Popover, Transition } from "@headlessui/react";
import { CheckCircleIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Fragment, useState } from "react";
import DropSpeaker from "../icons/DropDown/DropSpeaker";
import test_sound from "../sounds/test_sound.mp3";
import { useMeetingAppContext } from "../context/MeetingAppContext";

export default function DropDownSpeaker({ speakers }) {
  const { setSelectedSpeaker, selectedSpeaker, isMicrophonePermissionAllowed } =
    useMeetingAppContext();

  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const testSpeakers = () => {
    if (!selectedSpeaker?.id) return;
    const audio = new Audio(test_sound);
    try {
      audio.setSinkId(selectedSpeaker.id).then(() => {
        audio.play();
        setIsPlaying(true);
        audio.addEventListener("timeupdate", () =>
          setProgress((audio.currentTime / audio.duration) * 100)
        );
        audio.addEventListener("ended", () => {
          setProgress(0);
          setIsPlaying(false);
        });
      });
    } catch (e) {
      audio.play().catch(console.error);
    }
  };

  return (
    <Popover className="relative w-full">
      {({ open }) => (
        <>
          <Popover.Button
            disabled={!isMicrophonePermissionAllowed}
            className="w-full flex items-center gap-1.5 px-2 py-[6px] bg-black/[0.02] border border-black/[0.05] rounded text-sm text-gray-900 focus:outline-none hover:bg-black/[0.05] transition-colors disabled:opacity-50"
          >
            <DropSpeaker fillColor="#6B7280" />
            <span className="flex-1 truncate text-left font-normal">
              {isMicrophonePermissionAllowed
                ? (selectedSpeaker?.label || "Default speaker")
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
                  {speakers.map((item, i) =>
                    item?.kind === "audiooutput" ? (
                      <button
                        key={`spk_${i}`}
                        onClick={() =>
                          setSelectedSpeaker({ id: item.deviceId, label: item.label })
                        }
                        className="flex items-center justify-between gap-6 px-4 py-2.5 text-sm text-gray-900 text-left hover:bg-black/5 transition-colors w-full whitespace-nowrap"
                      >
                        <span className="font-normal">{item.label || `Speaker ${i + 1}`}</span>
                        {selectedSpeaker?.label === item.label && (
                          <CheckCircleIcon className="w-5 h-5 text-gray-500 shrink-0" />
                        )}
                      </button>
                    ) : null
                  )}
                </div>
                {speakers.length > 0 && (
                  <button
                    onClick={testSpeakers}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#ff6f61] hover:bg-[#ff5a4a] text-white text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    {isPlaying ? (
                      <div className="w-20 bg-white/30 rounded-full h-1 overflow-hidden">
                        <div className="bg-white h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    ) : (
                      "Test Speakers"
                    )}
                  </button>
                )}
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
