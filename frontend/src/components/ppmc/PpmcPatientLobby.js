/**
 * PpmcPatientLobby — shown to the PPMC patient while they're in the "ask_join"
 * waiting state (doctor hasn't admitted them yet).
 *
 * Replaces WaitingToJoinScreen for flow=ppmc mode=PATIENT only.
 * Normal MER flow is unaffected.
 */
import React from "react";

const PpmcPatientLobby = ({ denied = false }) => {
  if (denied) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-[5px]" />
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-5xl">🚫</div>
          <p className="text-white text-2xl font-semibold">Entry Declined</p>
          <p className="text-gray-300 text-sm max-w-xs">
            The doctor has declined your request to join. Please contact your
            care team if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-[5px]" />
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center">
        {/* Spinner */}
        <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        <p className="text-white text-[28px] font-medium leading-snug select-none">
          Waiting for the doctor to admit you…
        </p>
        <p className="text-gray-400 text-sm select-none">
          Please keep this tab open. You'll be connected automatically.
        </p>
      </div>
    </div>
  );
};

export default PpmcPatientLobby;
