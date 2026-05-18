import { useMeeting } from "@videosdk.live/react-sdk";
import { MemoizedParticipant } from "../../ParticipantView";

export default function CameraTab() {
  const { participants, localParticipant } = useMeeting();

  const remoteIds = [...participants.keys()].filter(
    (id) => id !== localParticipant.id && participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  );
  const customerId = remoteIds[0] ?? null;

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Customer video — fills the area */}
      <div className="w-full h-full">
        {customerId ? (
          <MemoizedParticipant
            participantId={customerId}
            showImageCapture={true}
            showResolution={true}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm">Waiting for customer to join...</p>
          </div>
        )}
      </div>

      {/* Doctor PiP — bottom-right corner */}
      <div className="absolute bottom-4 right-4 w-36 h-28 md:w-52 md:h-36 rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg z-10">
        <MemoizedParticipant
          participantId={localParticipant.id}
          showImageCapture={false}
          showResolution={false}
          isPip={true}
        />
      </div>
    </div>
  );
}
