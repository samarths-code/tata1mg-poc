import { useState, useCallback } from "react";

/**
 * Returns the onAudioInputSilence handler to register in the single
 * useMeeting call, plus reactive state derived from it.
 */
export function useAudioInputSilence() {
  const [isSilent, setIsSilent] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState(null);

  const onAudioInputSilence = useCallback((data) => {
    const { devicelabel, state } = data;
    
    if (state === "detected") {
      setIsSilent(true);
      setDeviceLabel(devicelabel ?? null);
    } else {
      setIsSilent(false);
      setDeviceLabel(null);
    }
  }, []);

  return { isSilent, deviceLabel, onAudioInputSilence };
}
