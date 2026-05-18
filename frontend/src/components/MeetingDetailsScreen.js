import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { toast } from "react-toastify";

export function MeetingDetailsScreen({
  onClickJoin,
  _handleOnCreateMeeting,
  participantName,
  setParticipantName,
  videoTrack,
  setVideoTrack,
  onClickStartMeeting,
}) {
  const url = new URLSearchParams(window.location.search);
  const MeetingId = url.get("meetingId");
  const mode = url.get("mode");

  const [meetingId, setMeetingId] = useState(MeetingId || "");
  const [meetingIdError, setMeetingIdError] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [iscreateMeetingClicked, setIscreateMeetingClicked] = useState(
    MeetingId && mode === "AGENT" ? true : false
  );
  const [isJoinMeetingClicked, setIsJoinMeetingClicked] = useState(
    MeetingId && !mode ? true : false
  );

  return (
    <div className="flex flex-1 flex-col justify-center w-full">
      {iscreateMeetingClicked ? (
        <div className="border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-center bg-orange-50">
          <p className="text-gray-800 text-sm font-mono font-semibold flex-1 truncate">
            {`Code: ${meetingId}`}
          </p>
          <button
            className="ml-2 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(meetingId);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 3000);
            }}
          >
            {isCopied ? (
              <CheckIcon className="h-5 w-5 text-green-500" />
            ) : (
              <ClipboardIcon className="h-5 w-5 text-orange-450" />
            )}
          </button>
        </div>
      ) : isJoinMeetingClicked ? (
        <>
          <input
            defaultValue={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            placeholder="Enter meeting ID"
            className="px-4 py-3 bg-white border border-orange-200 rounded-xl text-gray-800 w-full text-center focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-450 transition-colors placeholder-gray-400"
          />
          {meetingIdError && (
            <p className="text-xs text-red-500 mt-1">{`Please enter a valid meeting ID`}</p>
          )}
        </>
      ) : null}

      {(iscreateMeetingClicked || isJoinMeetingClicked) && (
        <>
          <input
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            placeholder="Enter your name"
            className="px-4 py-3 mt-4 bg-white border border-orange-200 rounded-xl text-gray-800 w-full text-center focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-450 transition-colors placeholder-gray-400"
          />
          <button
            disabled={participantName.length < 3}
            className={`w-full text-white px-2 py-3 rounded-xl mt-4 font-semibold transition-colors ${
              participantName.length < 3
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-orange-450 hover:bg-orange-500"
            }`}
            onClick={(e) => {
              if (iscreateMeetingClicked) {
                if (videoTrack) {
                  videoTrack.stop();
                  setVideoTrack(null);
                }
                onClickStartMeeting();
                toast(`Join screen button clicked`, {
                  position: "bottom-left",
                  autoClose: 4000,
                  hideProgressBar: true,
                  closeButton: false,
                  pauseOnHover: true,
                  draggable: true,
                  progress: undefined,
                  theme: "light",
                });
              } else {
                if (meetingId.match("\\w{4}\\-\\w{4}\\-\\w{4}")) {
                  onClickJoin(meetingId);
                  toast(`Join screen button clicked`, {
                    position: "bottom-left",
                    autoClose: 4000,
                    hideProgressBar: true,
                    closeButton: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "light",
                  });
                } else setMeetingIdError(true);
              }
            }}
          >
            {iscreateMeetingClicked ? "Start meeting" : "Join meeting"}
          </button>
        </>
      )}

      {!iscreateMeetingClicked && !isJoinMeetingClicked && !MeetingId && (
        <div className="w-full flex flex-col gap-3">
          <button
            className="w-full bg-orange-450 hover:bg-orange-500 text-white px-2 py-3 rounded-xl font-semibold transition-colors"
            onClick={async () => {
              const meetingId = await _handleOnCreateMeeting();
              setMeetingId(meetingId);
              setIscreateMeetingClicked(true);
            }}
          >
            Create a meeting
          </button>
          <button
            className="w-full border-2 border-orange-450 text-orange-450 hover:bg-orange-50 px-2 py-3 rounded-xl font-semibold transition-colors"
            onClick={() => setIsJoinMeetingClicked(true)}
          >
            Join a meeting
          </button>
        </div>
      )}
    </div>
  );
}
