import { Popover, Transition } from "@headlessui/react";
import { CheckCircleIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Fragment, useEffect, useRef, useState } from "react";
import DropMIC from "../icons/DropDown/DropMIC";
import { useMeetingAppContext } from "../context/MeetingAppContext";

export default function DropDownMic({
  mics,
  changeMic,
  audioTrack,
  micOn,
  didDeviceChange,
  setDidDeviceChange,
}) {
  const { selectedMicrophone, setSelectedMicroPhone, isMicrophonePermissionAllowed } =
    useMeetingAppContext();

  const [volume, setVolume] = useState(0);
  const audioAnalyserRef = useRef();

  useEffect(() => {
    if (didDeviceChange) setDidDeviceChange(false);
  }, [didDeviceChange]);

  useEffect(() => {
    if (!audioTrack) { clearInterval(audioAnalyserRef.current); return; }

    const stream = new MediaStream([audioTrack]);
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    audioAnalyserRef.current = setInterval(() => {
      analyser.getByteFrequencyData(buf);
      setVolume(buf.reduce((s, v) => s + v, 0) / buf.length);
    }, 100);

    return () => clearInterval(audioAnalyserRef.current);
  }, [audioTrack]);

  return (
    <Popover className="relative w-full">
      {({ open }) => (
        <>
          <Popover.Button
            disabled={!isMicrophonePermissionAllowed}
            className="w-full flex items-center gap-1.5 px-2 py-[6px] bg-black/[0.02] border border-black/[0.05] rounded text-sm text-gray-900 focus:outline-none hover:bg-black/[0.05] transition-colors disabled:opacity-50"
          >
            <DropMIC fillColor="#6B7280" />
            <span className="flex-1 truncate text-left font-normal">
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
                        <span className="font-normal">{item.label || `Mic ${i + 1}`}</span>
                        {selectedMicrophone?.label === item.label && (
                          <CheckCircleIcon className="w-5 h-5 text-gray-500 shrink-0" />
                        )}
                      </button>
                    ) : null
                  )}
                </div>
                <div className="border-t border-black/10 px-4 py-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <div className="flex-1 bg-gray-300 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-green-500 h-1 rounded-full transition-all duration-100"
                      style={{ width: `${micOn ? (volume / 256) * 100 : 0}%` }}
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
