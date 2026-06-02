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
    // Fixed overlay so it sits above MeetingContainer's dark bg and fills the screen
    <div
      className="fixed inset-0 z-50 overflow-hidden"
    >

      {/* Glass morphism layer */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-2xl" />

      {/* Joining text */}
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <p className="text-white text-[32px] font-medium leading-9 tracking-tight select-none">
          {waitingMessages[msgIndex]}
        </p>
      </div>
    </div>
  );
};

export default WaitingToJoinScreen;
