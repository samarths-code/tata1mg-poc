// SDK v1 made every meeting/participant method promise-based: they reject
// instead of only reporting through onError. A method also rejects outright
// when called before onMeetingJoined (ERROR_ACTION_PERFORMED_BEFORE_MEETING_
// JOINED), while reconnecting (ERROR_MEETING_RECONNECTING), or when another
// enable/disable is still running (ERROR_OPERATION_IN_PROGRESS).
//
// A plain try/catch around a non-awaited call cannot catch any of those, so
// fire-and-forget SDK calls go through here to keep them off the console as
// unhandled rejections.
export function fireSdk(fn, label) {
  try {
    const result = fn();
    if (result && typeof result.catch === "function") {
      result.catch((e) => console.warn(`${label || "SDK call"} failed:`, e?.message ?? e));
    }
    return result;
  } catch (e) {
    console.warn(`${label || "SDK call"} threw:`, e?.message ?? e);
    return undefined;
  }
}
