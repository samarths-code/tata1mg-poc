import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { toast } from "react-toastify";

export function MeetingDetailsScreen({
  onClickJoin,
  participantName,
  setParticipantName,
  videoTrack,
  setVideoTrack,
  onClickStartMeeting,
}) {
  const url = new URLSearchParams(window.location.search);
  const MeetingId = url.get("meetingId");

  const [meetingId, setMeetingId] = useState(MeetingId || "");
  const [meetingIdError, setMeetingIdError] = useState(false);
  const [isJoinMeetingClicked, setIsJoinMeetingClicked] = useState(!!MeetingId);

  return (
    <div className="flex flex-1 flex-col justify-center w-full">
      {isJoinMeetingClicked ? (
        <>
          <input
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            readOnly={!!MeetingId}
            placeholder="Enter meeting ID"
            className={`px-4 py-3 border border-orange-200 rounded-xl w-full text-center focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-450 transition-colors placeholder-gray-400 ${
              MeetingId
                ? "bg-gray-50 text-gray-500 cursor-not-allowed select-none"
                : "bg-white text-gray-800"
            }`}
          />
          {meetingIdError && (
            <p className="text-xs text-red-500 mt-1">Please enter a valid meeting ID</p>
          )}
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
            onClick={() => {
              if (meetingId.match("\\w{4}\\-\\w{4}\\-\\w{4}")) {
                onClickJoin(meetingId);
                toast("Joining meeting…", {
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
                setMeetingIdError(true);
              }
            }}
          >
            Join Meeting
          </button>
        </>
      ) : (
        <button
          className="w-full border-2 border-orange-450 text-orange-450 hover:bg-orange-50 px-2 py-3 rounded-xl font-semibold transition-colors"
          onClick={() => setIsJoinMeetingClicked(true)}
        >
          Join a Meeting
        </button>
      )}
    </div>
  );
}
