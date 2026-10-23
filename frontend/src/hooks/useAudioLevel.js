import { useEffect, useState } from "react";

// One AudioContext for every tile — browsers cap how many can exist.
let sharedCtx = null;
function getCtx() {
  if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new AudioContext();
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

const POLL_MS = 100;
const LEVELS = 4; // 0 = silent, 1..4 = louder

// Speaking level (0..LEVELS) of an audio MediaStreamTrack, local or remote.
// Quantised so a tile only re-renders when the bucket changes, not every poll.
export default function useAudioLevel(track) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!track) { setLevel(0); return; }
    let ctx, src, analyser, id;
    try {
      ctx = getCtx();
      src = ctx.createMediaStreamSource(new MediaStream([track]));
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      // Analyser only — never connected to ctx.destination, so nothing is played twice.
      src.connect(analyser);
    } catch (e) {
      console.warn("useAudioLevel: analyser unavailable", e);
      return;
    }

    const buf = new Uint8Array(analyser.fftSize);
    let last = 0;
    id = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      // ~0.02 is background noise; ~0.25 is loud speech.
      const next = rms < 0.02 ? 0 : Math.min(LEVELS, Math.ceil((rms / 0.25) * LEVELS));
      if (next !== last) { last = next; setLevel(next); }
    }, POLL_MS);

    return () => {
      clearInterval(id);
      try { src.disconnect(); } catch (e) { /* noop */ }
      setLevel(0);
    };
  }, [track]);

  return level;
}
