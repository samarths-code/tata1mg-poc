// Registry of every camera/mic track this app opens (pre-call preview, tracks
// re-created on join, camera toggles, virtual-background input/output…).
// The SDK only cleans up what it currently publishes; tracks we created and
// later swapped out stay live — keeping the browser's camera/mic indicator on
// after the call ends. releaseAllMedia() stops everything we ever opened.
import { stopVirtualBackground } from "./virtualBackground";

const tracks = new Set();

// Register a MediaStream (or MediaStreamTrack); returns it unchanged.
export function trackMedia(streamOrTrack) {
  if (!streamOrTrack) return streamOrTrack;
  const list = typeof streamOrTrack.getTracks === "function"
    ? streamOrTrack.getTracks()
    : [streamOrTrack];
  list.forEach((t) => {
    if (t.readyState === "ended") return;
    tracks.add(t);
    t.addEventListener("ended", () => tracks.delete(t), { once: true });
  });
  return streamOrTrack;
}

export const liveTrackCount = () =>
  [...tracks].filter((t) => t.readyState === "live").length;

export async function releaseAllMedia(extra = []) {
  await stopVirtualBackground();
  [...tracks, ...extra].forEach((t) => {
    try { t?.stop(); } catch (e) { /* already stopped */ }
  });
  tracks.clear();
}
