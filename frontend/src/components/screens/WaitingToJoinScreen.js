import React, { useEffect, useRef, useState } from "react";

const waitingMessages = [
  "Joining...",
  "Almost there...",
  "Setting up your call...",
];

const WaitingToJoinScreen = () => {
  const [msgIndex, setMsgIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setMsgIndex((i) => (i < waitingMessages.length - 1 ? i + 1 : i));
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Blurs the video/content behind — subtle dark tint so glass reads clearly */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xl" />

      {/* Centered glass pill */}
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-10 py-5 shadow-xl">
          <p className="text-white text-[28px] font-medium leading-9 tracking-tight select-none">
            {waitingMessages[msgIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WaitingToJoinScreen;
