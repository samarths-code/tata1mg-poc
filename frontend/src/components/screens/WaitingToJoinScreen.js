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
    <div className="flex h-full w-full items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm">
      <p className="text-white text-[32px] font-medium leading-9 tracking-tight select-none">
        {waitingMessages[msgIndex]}
      </p>
    </div>
  );
};

export default WaitingToJoinScreen;
