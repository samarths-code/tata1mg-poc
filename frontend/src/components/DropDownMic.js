import { Popover, Transition } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react'
import React, { useEffect, useRef, useState } from "react";
import DropMIC from '../icons/DropDown/DropMIC';
import TestMic from "../icons/DropDown/TestMic"
import TestMicOff from '../icons/DropDown/TestMicOff';
import { useMeetingAppContext } from '../context/MeetingAppContext';
import useIsMobile from '../hooks/useIsMobile';

export default function DropDownMic({
  mics,
  changeMic,
  customAudioStream,
  audioTrack,
  micOn,
  didDeviceChange,
  setDidDeviceChange,
  testSpeaker,
  setTestSpeaker
}) {

  const {
    selectedMicrophone,
    setSelectedMicroPhone,
    isMicrophonePermissionAllowed
  } = useMeetingAppContext();

  const [volume, setVolume] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile()

  const audioTrackRef = useRef();
  const audioAnalyserIntervalRef = useRef();

  useEffect(() => {
    audioTrackRef.current = audioTrack;

    if (audioTrack) {
      analyseAudio(audioTrack);
    } else {
      stopAudioAnalyse();
    }
  }, [audioTrack]);

  useEffect(() => {
    if (didDeviceChange) {
      setDidDeviceChange(false)
    }
  }, [didDeviceChange])

  const analyseAudio = (audioTrack) => {
    const audioStream = new MediaStream([audioTrack]);
    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(audioStream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 512;
    analyser.minDecibels = -127;
    analyser.maxDecibels = 0;
    analyser.smoothingTimeConstant = 0.4;

    audioSource.connect(analyser);

    const volumes = new Uint8Array(analyser.frequencyBinCount);
    const volumeCallback = () => {
      analyser.getByteFrequencyData(volumes);
      const volumeSum = volumes.reduce((sum, vol) => sum + vol);
      const averageVolume = volumeSum / volumes.length;
      setVolume(averageVolume);
    };
    audioAnalyserIntervalRef.current = setInterval(volumeCallback, 100);
  };

  const stopAudioAnalyse = () => {
    clearInterval(audioAnalyserIntervalRef.current);
  };

  return (
    <>
      <Popover className="relative w-full ">
        {({ open }) => (
          <>
            <Popover.Button
              onMouseEnter={() => { setIsHovered(true) }}
              onMouseLeave={() => { setIsHovered(false) }}
              disabled={!isMicrophonePermissionAllowed}
              className={`focus:outline-none hover:ring-1 hover:ring-orange-200 hover:bg-orange-50
              ${open
                  ? "text-gray-800 ring-1 ring-orange-200 bg-orange-50"
                  : "text-gray-600 hover:text-gray-900"
                }
              group inline-flex items-center rounded-md px-1 py-1 w-full text-base font-normal
              ${!isMicrophonePermissionAllowed ? "opacity-50" : ""}`}
            >
              <div>
                <DropMIC fillColor={isHovered || open ? "#FF6F61" : "#9CA3AF"} />

              </div>
              <span className="overflow-hidden whitespace-nowrap overflow-ellipsis w-full ml-6">
                {isMicrophonePermissionAllowed ? selectedMicrophone?.label : "Permission Needed"}
              </span>
              <ChevronDownIcon
                className={`${open ? 'text-white' : 'text-customGray-250 hover:text-white'}
                ml-8 h-5 w-10 transition duration-150 ease-in-out group-hover:text-orange-300/80 mt-1`}
                aria-hidden="true"
              />
            </Popover.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <Popover.Panel className="absolute bottom-full z-10 mt-3 w-full px-4 sm:px-0 pb-2">
                <div className="rounded-lg shadow-lg">
                  <div className="bg-white border border-orange-100 rounded-lg">
                    <div>
                      <div className="flex flex-col">
                        {mics.map(
                          (item, index) => {
                            return (
                              item?.kind === "audioinput" && (
                                <div
                                  key={`mics_${index}`}
                                  className={` my-1 pl-4 pr-2 text-gray-700 text-left flex`}
                                >
                                  <span className="w-6 mr-2 flex items-center justify-center">
                                    {selectedMicrophone?.label === item?.label && (
                                      <CheckIcon className='h-5 w-5' />
                                    )}
                                  </span>
                                  <button
                                    className={`flex flex-1 w-full text-left`}
                                    value={item?.deviceId}
                                    onClick={() => {
                                      setSelectedMicroPhone((s) => ({
                                        ...s,
                                        label: item?.label,
                                        id: item?.deviceId,
                                      }));
                                      changeMic(item?.deviceId);
                                    }}
                                  >
                                    {item?.label ? (
                                      <span>{item?.label}</span>
                                    ) : (
                                      <span>{`Mic ${index + 1}`}</span>
                                    )}
                                  </button>
                                </div>
                              )
                            );
                          }
                        )}

                        <hr className='border border-gray-100 mt-2 mb-1' />

                        {micOn ? (
                          <div className="flex items-center gap-3 my-1 mb-2 pl-3 pr-2">
                            <TestMic />
                            <div className="flex-1 bg-gray-200 rounded-full h-1">
                              <div className="bg-gray-400 h-1 rounded-full transition-all" style={{ width: `${(volume ?? 0) / 256 * 100}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className='text-gray-400 flex flex-1 items-center gap-2 w-full mb-2 pl-3'>
                            <TestMicOff />
                            <span className="text-xs">Unmute to test your mic</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </>
  )
}

