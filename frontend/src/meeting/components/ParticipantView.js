import React, { useMemo } from "react";
import { useMeeting } from "@videosdk.live/react-sdk";
import { MemoizedParticipantGrid } from "../../components/ParticipantGrid";
import SideBySideLayout from "../../components/SideBySideLayout";

function ParticipantsViewer({ statusMessage }) {
  const {
    participants,
    pinnedParticipants,
    activeSpeakerId,
    localParticipant,
  } = useMeeting();

  const participantIds = useMemo(() => {
    const isRecorder = (id) =>
      participants.get(id)?.displayName?.toLowerCase() === "recorder";

    const pinnedParticipantId = [...pinnedParticipants.keys()].filter(
      (participantId) => {
        return participantId != localParticipant.id && !isRecorder(participantId);
      }
    );
    const regularParticipantIds = [...participants.keys()].filter(
      (participantId) => {
        return (
          ![...pinnedParticipants.keys()].includes(participantId) &&
          localParticipant.id != participantId &&
          !isRecorder(participantId)
        );
      }
    );

    const ids = [
      localParticipant.id,
      ...pinnedParticipantId,
      ...regularParticipantIds,
    ].slice(0, 16);

    if (activeSpeakerId) {
      if (!ids.includes(activeSpeakerId)) {
        ids[ids.length - 1] = activeSpeakerId;
      }
    }
    return ids;
  }, [
    participants,
    activeSpeakerId,
    pinnedParticipants,
  ]);

  if (participantIds.length > 2) {
    return (
      <MemoizedParticipantGrid participantIds={participantIds} />
    );
  }
  // 1:1 call — doctor (remote) on the left, self on the right.
  const [selfId, otherId] = participantIds;
  return (
    <SideBySideLayout
      tiles={[otherId ?? null, selfId]}
      waitingText={statusMessage || "Waiting for Other Participant..."}
      statusMessage={otherId ? statusMessage : null}
    />
  );
}

const MemorizedParticipantView = React.memo(
  ParticipantsViewer,
  (prevProps, nextProps) => {
    return prevProps.statusMessage === nextProps.statusMessage;
  }
);

export default MemorizedParticipantView;
