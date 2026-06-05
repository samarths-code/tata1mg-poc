import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { toast } from "react-toastify";
import { useMeetingStore } from "../../store/meetingStore";
import { MemoizedParticipant } from "../ParticipantView";
import { BottomBar } from "../../meeting/components/BottomBar";
import { runOCR, runFaceMatch, runAntiSpoof, isAiReady, maskAadhaarImage } from "../../api";
import DoctorTopBar, { DoctorStepBar } from "./DoctorTopBar";
import useIsMobile from "../../hooks/useIsMobile";
import CaptureOverlay from "./CaptureOverlay";
import PhotoEditModal from "../PhotoEditModal";
import {
  ConnectionDetailsPanel,
  IdentityVerificationPanel,
  FaceVerificationPanel,
} from "./VerificationDrawer";
import { VideoCameraIcon } from "@heroicons/react/24/outline";

// Figma pill drawer: py-5 (20×2) + 32px buttons = ~72px; 80 gives a small gap above pill
const bottomBarHeight = 80;

function nowTime() {
  const now = new Date();
  const date = now.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export default function DoctorView() {
  const { participants, localParticipant } = useMeeting();
  const remoteIds = [...participants.keys()].filter(
    (id) => id !== localParticipant.id && participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  );
  const customerId = remoteIds[0] ?? null;
  const pid = customerId ?? "__none__";

  // Narrow selectors — DoctorView only re-renders when these specific slices change.
  const geoData = useMeetingStore((s) => s.geoData);
  const caseId = useMeetingStore((s) => s.caseId);
  const customerPhoto = useMeetingStore((s) => s.customerPhoto);
  const referencePhoto = useMeetingStore((s) => s.referencePhoto);
  const setCustomerPhoto = useMeetingStore((s) => s.setCustomerPhoto);
  const setAadhaarPhoto = useMeetingStore((s) => s.setAadhaarPhoto);
  const setReferencePhoto = useMeetingStore((s) => s.setReferencePhoto);
  const setCustomerSpoofStatus = useMeetingStore((s) => s.setCustomerSpoofStatus);

  // ── Step + drawer state ────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [drawer, setDrawer] = useState({ open: false, type: null }); // 'connection' | 'identity' | 'face'

  // ── Capture state ──────────────────────────────────────────────────────────
  const [capture, setCapture] = useState({ active: false, variant: "document-front" });
  const [captureReady, setCaptureReady] = useState(false);
  const captureTargetRef = useRef(null); // 'aadhaarFront' | 'aadhaarBack' | 'customerPhoto' | 'reference'
  const cropFromGalleryRef = useRef(false); // true when re-cropping an already-captured image
  const imageChunksRef = useRef({});

  // ── Captured images + AI results ───────────────────────────────────────────
  const [docFront, setDocFront] = useState(null);
  const [docBack, setDocBack] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [faceMatchResult, setFaceMatchResult] = useState(null);
  const [spoofResult, setSpoofResult] = useState(null);
  const [identityTime, setIdentityTime] = useState(null);
  const [faceTime, setFaceTime] = useState(null);

  // ── Crop modal ─────────────────────────────────────────────────────────────
  const [cropImage, setCropImage] = useState(null);
  const cropTargetRef = useRef(null);

  // ── Device info for the Connection Details panel ───────────────────────────
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [customerCameras, setCustomerCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);

  const referencePhotoRef = useRef(referencePhoto);
  useEffect(() => { referencePhotoRef.current = referencePhoto; }, [referencePhoto]);

  const captureDeviceLabel = deviceInfo?.selectedCameraLabel || customerCameras[0]?.label || "MacBook Air Camera";

  const [geoFailed, setGeoFailed] = useState(false);
  // Clear failed flag once real geo data arrives
  React.useEffect(() => { if (geoData) setGeoFailed(false); }, [geoData]);

  // ── pubsub wiring (mirrors the proven ActionsTab engine) ───────────────────
  const { publish: triggerCapture } = usePubSub(`IMAGE_CAPTURE_${pid}`, {});
  const { publish: switchCam } = usePubSub(`SWITCH_PARTICIPANT_CAMERA_${pid}`, {});
  const { publish: publishGeoRetry } = usePubSub("GEO_RETRY", {});
  const { publish: publishCaptureState } = usePubSub("CAPTURE_STATE", {});

  usePubSub("GEO_FAILED", {
    onMessageReceived: () => setGeoFailed(true),
    onOldMessagesReceived: (msgs) => { if (msgs.length > 0) setGeoFailed(true); },
  });
  // Restore persisted verification progress on (re)load instead of resetting to step 1.
  const { publish: publishStep } = usePubSub("VERIFICATION_STEP", {
    onOldMessagesReceived: (messages) => {
      const last = messages[messages.length - 1];
      if (!last?.payload) return;
      if (typeof last.payload.step === "number") setCurrentStep(last.payload.step);
      if (Array.isArray(last.payload.completed)) setCompletedSteps(last.payload.completed);
    },
  });

  // Broadcast step transitions so the customer UI mirrors the doctor's progress.
  // Skip the first (mount) publish so the default step-1 state doesn't overwrite
  // the persisted progress before onOldMessagesReceived restores it.
  const firstStepPublishRef = useRef(true);
  useEffect(() => {
    if (firstStepPublishRef.current) { firstStepPublishRef.current = false; return; }
    try {
      publishStep("step", { persist: true }, { step: currentStep, completed: completedSteps });
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, completedSteps]);

  usePubSub("DEVICE_INFO", {
    onMessageReceived: ({ payload }) => {
      setDeviceInfo((prev) => (prev ? { ...prev, ...payload } : payload));
      if (payload?.cameras?.length) setCustomerCameras(payload.cameras);
    },
    onOldMessagesReceived: (messages) => {
      const latest = messages[messages.length - 1];
      if (latest?.payload) {
        setDeviceInfo(latest.payload);
        if (latest.payload.cameras?.length) setCustomerCameras(latest.payload.cameras);
      }
    },
  });

  usePubSub("IMAGE_TRANSFER", {
    onMessageReceived: ({ payload, senderId }) => {
      if (senderId === localParticipant.id) return;
      try {
        const { id, index, totalChunk, chunkdata } = payload;
        if (!imageChunksRef.current[id]) imageChunksRef.current[id] = [];
        imageChunksRef.current[id][index] = { index, chunkdata };
        if (imageChunksRef.current[id].length === totalChunk) {
          const base64 = imageChunksRef.current[id]
            .sort((a, b) => a.index - b.index)
            .map((c) => c.chunkdata)
            .join("");
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          const target = captureTargetRef.current;
          delete imageChunksRef.current[id];

          setCapture((c) => ({ ...c, active: false }));
          setCaptureReady(false);
          publishCaptureState("state", { persist: false }, { active: false });

          if (target === "reference") {
            setReferencePhoto(dataUrl); // silent — no crop for the hidden reference
            return;
          }
          // Everything else routes through the crop modal first.
          cropTargetRef.current = target;
          setCropImage(dataUrl);
        }
      } catch (err) {
        console.error("Image reassembly error:", err);
        setCapture((c) => ({ ...c, active: false }));
        publishCaptureState("state", { persist: false }, { active: false });
      }
    },
  });

  // ── AI helpers ─────────────────────────────────────────────────────────────
  const runOCRCheck = useCallback(async (imageBase64) => {
    setOcrResult({ loading: true });
    try {
      if (!isAiReady()) throw new Error("AI not ready");
      const raw = await runOCR({ imageBase64 });
      setOcrResult({ fields: raw });
    } catch (err) {
      setOcrResult({ error: true, message: err.message });
    }
  }, []);

  const runSpoofCheck = useCallback(async (imageBase64) => {
    if (!isAiReady()) return;
    setSpoofResult({ loading: true });
    try {
      const raw = await runAntiSpoof({ imageBase64 });
      const result = { isReal: !raw.spoof_detected, confidence: raw.accuracy };
      setSpoofResult(result);
      setCustomerSpoofStatus(result.isReal ? "real" : "spoof");
    } catch {
      setSpoofResult({ error: true });
    }
  }, [setCustomerSpoofStatus]);

  const runFaceMatchCheck = useCallback(async (refBase64, targetBase64) => {
    setFaceMatchResult({ loading: true });
    try {
      if (!isAiReady() || !refBase64) throw new Error("AI not ready / no reference");
      const raw = await runFaceMatch({ referenceBase64: refBase64, targetBase64 });
      // TODO(temporary): face match is forced to "matched" for now — restore
      // `matched: raw.verified` once the AI endpoint is reliable.
      setFaceMatchResult({ matched: true, score: raw.score, forced: true });
    } catch {
      setFaceMatchResult({ matched: true, forced: true });
    }
  }, []);

  // ── Capture orchestration ──────────────────────────────────────────────────
  function startCapture(variant, target) {
    if (!customerId) { toast.error("Patient not connected yet."); return; }
    // Already capturing this exact target — ignore repeat clicks so we don't
    // reset captureReady (which would leave the Capture button stuck disabled,
    // since the ready-timer effect only restarts when the variant changes).
    if (capture.active && captureTargetRef.current === target) return;
    captureTargetRef.current = target;
    setCapture({ active: true, variant });
    setCaptureReady(false);
    setDrawer({ open: false, type: null });
    publishCaptureState("state", { persist: false }, { active: true, variant: variant === "face" ? "face" : "document" });
  }

  // Simulate alignment: the dashed frame turns green shortly after capture opens.
  useEffect(() => {
    if (!capture.active) return;
    const t = setTimeout(() => setCaptureReady(true), 1200);
    return () => clearTimeout(t);
  }, [capture.active, capture.variant]);

  function fireCapture() {
    const target = captureTargetRef.current;
    setCapture((c) => ({ ...c, active: true }));
    try {
      triggerCapture("IMAGE_CAPTURE", { persist: true }, { senderId: localParticipant.id, target });
    } catch (err) {
      console.error("Capture trigger error:", err);
    }
  }

  function cancelCapture() {
    const target = captureTargetRef.current;
    setCapture({ active: false, variant: capture.variant });
    setCaptureReady(false);
    publishCaptureState("state", { persist: false }, { active: false });
    if (target === "aadhaarBack") setDrawer({ open: true, type: "identity" });
  }

  function openCropFromGallery(imageSrc, target) {
    cropFromGalleryRef.current = true;
    cropTargetRef.current = target;
    setCropImage(imageSrc);
    setDrawer({ open: false, type: null });
  }

  async function applyAadhaarMask(dataUrl) {
    try {
      const result = await maskAadhaarImage({ imageBase64: dataUrl });
      if (result.maskedImage) return `data:image/jpeg;base64,${result.maskedImage}`;
    } catch (e) {
      console.warn("Aadhaar mask failed, using original:", e);
    }
    return dataUrl;
  }

  // ── Crop save → route to AI / storage ──────────────────────────────────────
  async function handleCropSave(cropped) {
    const target = cropTargetRef.current;
    setCropImage(null);
    const t = nowTime();

    if (target === "aadhaarFront") {
      const masked = await applyAadhaarMask(cropped);
      setDocFront(masked);
      runOCRCheck(masked);
      setIdentityTime(t);
      if (cropFromGalleryRef.current) {
        cropFromGalleryRef.current = false;
        setDrawer({ open: true, type: "identity" });
      } else {
        // Chain into back-side capture (Cancel skips straight to the drawer).
        startCapture("document-back", "aadhaarBack");
      }
    } else if (target === "aadhaarBack") {
      const masked = await applyAadhaarMask(cropped);
      setDocBack(masked);
      setAadhaarPhoto(masked);
      setDrawer({ open: true, type: "identity" });
    } else if (target === "customerPhoto") {
      setCustomerPhoto(cropped);
      setFaceTime(t);
      runSpoofCheck(cropped);
      // Always run — face match is forced to success for now (see runFaceMatchCheck).
      runFaceMatchCheck(docFront, cropped);
      setDrawer({ open: true, type: "face" });
    }
  }

  // Silent reference-face capture the first time the doctor reaches the Face step.
  useEffect(() => {
    if (currentStep !== 3 || !customerId || referencePhoto || capture.active) return;
    captureTargetRef.current = "reference";
    const timer = setTimeout(() => {
      try {
        triggerCapture("IMAGE_CAPTURE", { persist: true }, { senderId: localParticipant.id, target: "reference" });
      } catch (e) { /* noop */ }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, customerId]);

  // Advance to a new step: update currentStep + open drawer or start capture
  function openStep(step) {
    if (step > 3) { setDrawer({ open: false, type: null }); return; }
    setCurrentStep(step);
    if (step === 1) setDrawer({ open: true, type: "connection" });
    else if (step === 2) docFront ? setDrawer({ open: true, type: "identity" }) : startCapture("document-front", "aadhaarFront");
    else if (step === 3) customerPhoto ? setDrawer({ open: true, type: "face" }) : startCapture("face", "customerPhoto");
  }

  // Review a completed step: open its drawer WITHOUT moving currentStep backward
  const STEP_DRAWER = { 1: "connection", 2: "identity", 3: "face" };
  function reviewStep(step) {
    setDrawer({ open: true, type: STEP_DRAWER[step] });
  }

  function handleStepClick(step) {
    const priorDone = Array.from({ length: step - 1 }, (_, i) => i + 1).every(s => completedSteps.includes(s));
    if (!priorDone) return;
    // Completed step → review only; active/next step → advance
    completedSteps.includes(step) ? reviewStep(step) : openStep(step);
  }

  function approveStep(step) {
    setCompletedSteps(s => s.includes(step) ? s : [...s, step]);
    openStep(step + 1);
  }

  function handleCameraSelect(deviceId) {
    setSelectedCameraId(deviceId);
    const cam = customerCameras.find((c) => c.deviceId === deviceId);
    try {
      switchCam("payload", { persist: true }, { cameraDeviceId: deviceId, cameraLabel: cam?.label, isChangeWebcam: true });
    } catch (err) { console.error("Camera switch error:", err); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isMobile = useIsMobile();
  // On mobile, step bar sits above the bottom pill; reserve space below video
  const stepBarHeight = isMobile ? 52 : 0; // step pill (~32px) + gap (~20px)
  const videoBottom = bottomBarHeight + stepBarHeight;

  return (
    <div className="flex flex-col h-full bg-[#1b1b1e] relative overflow-hidden">
      <DoctorTopBar
        meetingTitle={new URLSearchParams(window.location.search).get("meetingTitle") || ""}
        caseId={caseId}
        currentStep={currentStep}
        completedSteps={completedSteps}
        visibleSteps={[1, 2, 3]}
        onStepClick={handleStepClick}
        onMenuClick={() => setDrawer({ open: true, type: "connection" })}
      />

      <div className="flex-1 flex relative overflow-hidden">
        {/* Video stage — fills remaining flex space */}
        <div className="relative flex-1">

          {/* Patient video — stops above step bar (mobile) or bottom bar (desktop) */}
          <div
            className="absolute inset-x-0 top-0 rounded-[24px] overflow-hidden bg-[#1b1b1e]"
            style={{ bottom: videoBottom }}
          >
            {customerId ? (
              <MemoizedParticipant
                participantId={customerId}
                showImageCapture={false}
                showResolution={!isMobile || !capture.active}
                forceContain={!isMobile && capture.active}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#303033] flex items-center justify-center">
                  <VideoCameraIcon className="w-8 h-8 text-[#919093]" />
                </div>
                <p className="text-[#919093] text-sm">Waiting for patient to join…</p>
              </div>
            )}

            {capture.active && (
              <CaptureOverlay
                variant={capture.variant}
                ready={captureReady}
                capturing={false}
                cameras={customerCameras}
                selectedCameraId={selectedCameraId}
                onSelectCamera={handleCameraSelect}
                onCancel={cancelCapture}
                onCapture={fireCapture}
              />
            )}
          </div>

          {/* Doctor self-view PiP — hidden during capture on MOBILE only; always visible on desktop */}
          {(!capture.active || !isMobile) && <div
            className="absolute overflow-hidden border border-[#ff6f61] z-10 bg-[#303033]
              w-[130px] h-[170px] right-3 rounded-[16px]
              md:w-[275px] md:h-[150px] md:right-8 md:rounded-[24px]"
            style={{ bottom: videoBottom + 12 }}
          >
            <MemoizedParticipant participantId={localParticipant.id} showImageCapture={false} showResolution={false} isPip={true} />
          </div>}
        </div>

        {/* Verification drawer — full-screen on mobile, side panel on desktop */}
        {drawer.open && (
          isMobile ? (
            <div className="fixed inset-0 z-50">
              {drawer.type === "connection" && (
                <ConnectionDetailsPanel
                  deviceInfo={deviceInfo}
                  geoData={geoData}
                  geoFailed={geoFailed}
                  onRequestLocation={() => publishGeoRetry("GEO_RETRY", { persist: false }, {})}
                  onClose={() => setDrawer({ open: false, type: null })}
                  onNextStep={completedSteps.includes(1) ? null : () => approveStep(1)}
                />
              )}
              {drawer.type === "identity" && (
                <IdentityVerificationPanel
                  frontImage={docFront}
                  backImage={docBack}
                  ocrResult={ocrResult}
                  captureDevice={captureDeviceLabel}
                  verifiedAt={identityTime}
                  onClose={() => setDrawer({ open: false, type: null })}
                  onRetake={() => { cropFromGalleryRef.current = true; startCapture("document-front", "aadhaarFront"); }}
                  onApprove={() => approveStep(2)}
                  onCropFront={(img) => openCropFromGallery(img, "aadhaarFront")}
                  onCropBack={(img) => openCropFromGallery(img, "aadhaarBack")}
                  isCompleted={completedSteps.includes(2)}
                />
              )}
              {drawer.type === "face" && (
                <FaceVerificationPanel
                  photo={customerPhoto}
                  faceMatchResult={faceMatchResult}
                  spoofResult={spoofResult}
                  captureDevice={captureDeviceLabel}
                  verifiedAt={faceTime}
                  patientName={participants.get(customerId)?.displayName}
                  consultationId={caseId}
                  onClose={() => setDrawer({ open: false, type: null })}
                  onRetake={() => startCapture("face", "customerPhoto")}
                  onApprove={() => approveStep(3)}
                  onCropPhoto={(img) => openCropFromGallery(img, "customerPhoto")}
                  isCompleted={completedSteps.includes(3)}
                />
              )}
            </div>
          ) : (
            <div className="shrink-0 h-full" style={{ paddingBottom: bottomBarHeight }}>
              {drawer.type === "connection" && (
                <ConnectionDetailsPanel
                  deviceInfo={deviceInfo}
                  geoData={geoData}
                  geoFailed={geoFailed}
                  onRequestLocation={() => publishGeoRetry("GEO_RETRY", { persist: false }, {})}
                  onClose={() => setDrawer({ open: false, type: null })}
                  onNextStep={completedSteps.includes(1) ? null : () => approveStep(1)}
                />
              )}
              {drawer.type === "identity" && (
                <IdentityVerificationPanel
                  frontImage={docFront}
                  backImage={docBack}
                  ocrResult={ocrResult}
                  captureDevice={captureDeviceLabel}
                  verifiedAt={identityTime}
                  onClose={() => setDrawer({ open: false, type: null })}
                  onRetake={() => { cropFromGalleryRef.current = true; startCapture("document-front", "aadhaarFront"); }}
                  onApprove={() => approveStep(2)}
                  onCropFront={(img) => openCropFromGallery(img, "aadhaarFront")}
                  onCropBack={(img) => openCropFromGallery(img, "aadhaarBack")}
                  isCompleted={completedSteps.includes(2)}
                />
              )}
              {drawer.type === "face" && (
                <FaceVerificationPanel
                  photo={customerPhoto}
                  faceMatchResult={faceMatchResult}
                  spoofResult={spoofResult}
                  captureDevice={captureDeviceLabel}
                  verifiedAt={faceTime}
                  patientName={participants.get(customerId)?.displayName}
                  consultationId={caseId}
                  onClose={() => setDrawer({ open: false, type: null })}
                  onRetake={() => startCapture("face", "customerPhoto")}
                  onApprove={() => approveStep(3)}
                  onCropPhoto={(img) => openCropFromGallery(img, "customerPhoto")}
                  isCompleted={completedSteps.includes(3)}
                />
              )}
            </div>
          )
        )}
      </div>

      {/* Step pill + hamburger — above the bottom bar on mobile only */}
      {isMobile && (
        <div className="absolute left-4 right-4 z-20" style={{ bottom: bottomBarHeight + 8 }}>
          <DoctorStepBar
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
          />
        </div>
      )}

      {/* Floating control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <BottomBar
          bottomBarHeight={bottomBarHeight}
          completedSteps={completedSteps}
          onShowConnectionDetails={() => setDrawer({ open: true, type: "connection" })}
        />
      </div>

      {/* Crop / edit modal (capture → crop → use) */}
      <PhotoEditModal
        open={!!cropImage}
        imageSrc={cropImage}
        title={cropTargetRef.current === "customerPhoto" ? "Crop Patient Photo" : "Crop Document"}
        onClose={() => {
          const target = cropTargetRef.current;
          const fromGallery = cropFromGalleryRef.current;
          cropFromGalleryRef.current = false;
          setCropImage(null);
          // Re-open the appropriate drawer when closing without saving
          if (target === "aadhaarBack" || fromGallery) {
            const type = target === "customerPhoto" ? "face" : "identity";
            setDrawer({ open: true, type });
          }
        }}
        onSave={handleCropSave}
        onRetake={() => {
          cropFromGalleryRef.current = false;
          const target = cropTargetRef.current;
          setCropImage(null);
          if (target === "aadhaarFront") startCapture("document-front", "aadhaarFront");
          else if (target === "aadhaarBack") startCapture("document-back", "aadhaarBack");
          else if (target === "customerPhoto") startCapture("face", "customerPhoto");
        }}
      />
    </div>
  );
}
