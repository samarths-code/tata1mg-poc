import { useCallback } from "react";
import { usePubSub, useMeeting } from "@videosdk.live/react-sdk";

// Drop-in for usePubSub where the publish is fire-and-forget.
//
// SDK v1 made every method promise-based. publish() REJECTS before the meeting
// is joined (error 3035, "You must join the meeting before calling the
// publish() method") and while reconnecting — and the error ALSO goes to
// onError, so swallowing the rejection alone still surfaces it to the user.
//
// So this does two things: it refuses to call publish until the meeting is
// actually joined, and it attaches a catch to whatever does get through
// (a join can drop between the check and the call).
//
// Use usePubSub directly where the caller awaits and wants the error.
export default function useSafePublish(topic, listeners, properties) {
  const { publish, messages } = usePubSub(topic, listeners, properties);
  const { isMeetingJoined } = useMeeting();

  const safePublish = useCallback(
    (...args) => {
      if (!isMeetingJoined) return undefined;
      try {
        const result = publish(...args);
        if (result && typeof result.catch === "function") {
          result.catch(() => { /* raced a leave/reconnect — nothing to do */ });
        }
        return result;
      } catch (e) {
        return undefined;
      }
    },
    [publish, isMeetingJoined]
  );

  return { publish: safePublish, messages };
}
