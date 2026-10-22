import { useEffect, useState } from "react";

// One getStats() loop per participant, shared by every consumer.
// Before this, each tile's badge and each network watcher polled the same
// participant separately — 4 calls/2s in a 1:1 call for the same data.
const POLL_MS = 2000;

// participantId -> { subs:Set<fn>, timer, fetch:{video,audio}, snapshot }
const registry = new Map();

async function poll(id) {
  const entry = registry.get(id);
  if (!entry) return;
  try {
    // Video first; audio only when there's no camera, so we never make two
    // calls where one will do.
    let entries = (await entry.fetch.video?.()) ?? [];
    let isVideo = true;
    if (!entries.length) {
      entries = (await entry.fetch.audio?.()) ?? [];
      isVideo = false;
    }
    const snapshot = { entries, isVideo, at: Date.now() };
    entry.snapshot = snapshot;
    entry.subs.forEach((fn) => fn(snapshot));
  } catch (e) {
    // transient — subscribers keep their last snapshot
  }
}

// Returns the latest { entries, isVideo, at } for this participant, or null.
export default function useParticipantStats(participantId, getVideoStats, getAudioStats, enabled = true) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!enabled || !participantId) return;

    let entry = registry.get(participantId);
    if (!entry) {
      entry = { subs: new Set(), timer: null, fetch: {}, snapshot: null };
      registry.set(participantId, entry);
    }
    // Last subscriber's fetchers win; they're equivalent for a given id.
    entry.fetch.video = getVideoStats;
    entry.fetch.audio = getAudioStats;
    entry.subs.add(setSnapshot);

    if (entry.snapshot) setSnapshot(entry.snapshot);
    if (!entry.timer) {
      poll(participantId);
      entry.timer = setInterval(() => poll(participantId), POLL_MS);
    }

    return () => {
      entry.subs.delete(setSnapshot);
      if (entry.subs.size === 0) {
        clearInterval(entry.timer);
        registry.delete(participantId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, enabled]);

  return snapshot;
}
