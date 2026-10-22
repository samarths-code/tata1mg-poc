// Doctor-side branded background, per
// https://docs.videosdk.live/javascript/guide/interactive-live-streaming/virtual-background
//
// There is no picker: the Apollo background is applied automatically to the
// doctor's camera track (see store seeding + createVideoTrack). The processor
// package and its MediaPipe model load on first use, so a patient on a phone
// never downloads them. Desktop browsers only (SDK limitation).

// Served from /public. Always built off the CURRENT origin: package.json sets
// `homepage` to a full URL, so CRA compiles PUBLIC_URL to that whole origin —
// prefixing it with window.location.origin produced a doubled, broken URL, and
// using it alone would point a preview deployment at the production domain
// (a cross-origin image taints the processor's canvas).
const BACKGROUND_URL = `${window.location.origin}/virtual-backgrounds/apollo-healthaxis.jpg`;
const CONFIG = { type: "image", imageUrl: BACKGROUND_URL };

let processor = null;
// The raw camera stream feeding the processor. The SDK only knows about the
// processed stream, so we have to release the camera ourselves.
let rawStream = null;

async function getProcessor() {
  if (!processor) {
    const { VirtualBackgroundProcessor } = await import(
      /* webpackChunkName: "virtual-background" */ "@videosdk.live/videosdk-virtual-background-web"
    );
    processor = new VirtualBackgroundProcessor();
  }
  if (!processor.ready) await processor.init("meet");
  return processor;
}

function releaseRawStream() {
  rawStream?.getTracks().forEach((t) => t.stop());
  rawStream = null;
}

export const isVirtualBackgroundRunning = () => !!processor?.processorRunning;

// Pipes a fresh camera stream through the processor and returns the stream to
// publish. Callers fall back to the plain camera if this throws.
export async function applyVirtualBackground(cameraStream) {
  if (!cameraStream) return cameraStream;
  const p = await getProcessor();
  if (p.processorRunning) await p.stop();
  releaseRawStream();
  rawStream = cameraStream;
  return p.start(cameraStream, CONFIG);
}

export async function stopVirtualBackground() {
  if (processor?.processorRunning) {
    try { await processor.stop(); } catch (e) { console.warn("VB stop failed:", e); }
  }
  releaseRawStream();
}
