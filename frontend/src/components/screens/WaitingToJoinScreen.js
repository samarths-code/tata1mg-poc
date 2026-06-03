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

  // MeetingContainer's bg is transparent while this shows, so the JoiningScreen
  // page behind it IS the backdrop. backdrop-blur-[5px] blurs that full page.
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-[5px]" />
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <p className="text-white text-[32px] font-medium leading-[36px] text-center select-none">
          {waitingMessages[msgIndex]}
        </p>
      </div>
    </div>
  );
};

export default WaitingToJoinScreen;
