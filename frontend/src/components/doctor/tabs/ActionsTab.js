import { Fragment, useRef, useState } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useMeetingAppContext } from "../../../context/MeetingAppContext";
import {
  CameraIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  FaceSmileIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { submitDocuments, runAntiSpoof, runFaceMatch, runOCR } from "../../../api";
import PhotoEditModal from "../../PhotoEditModal";

const STEPS = ["Greeting", "Details", "Photo", "Aadhaar", "Submit"];

// ─── Step bar ─────────────────────────────────────────────────────────────────
function StepBar({ active }) {
  return (
    <div className="flex items-start px-5 pt-4 pb-3 border-b border-gray-300 shrink-0">
      {STEPS.map((label, i) => (
        <Fragment key={i}>
          <div className="flex flex-col items-center" style={{ minWidth: 48 }}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                i < active
                  ? "bg-orange-450 text-white"
                  : i === active
                  ? "bg-orange-450 text-white ring-4 ring-orange-450/20"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i < active ? "✓" : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1 text-center leading-tight w-12 ${
                i === active ? "font-semibold text-orange-450" : "text-gray-500"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mt-3.5 mx-1 transition-colors ${
                i < active ? "bg-orange-450" : "bg-gray-300"
              }`}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

// ─── Navigation row ────────────────────────────────────────────────────────────
function NavRow({ step, onBack, onNext, nextLabel, nextDisabled }) {
  return (
    <div className="flex justify-between items-center px-5 py-4 border-t border-gray-200 shrink-0 bg-white">
      <button
        onClick={onBack}
        disabled={step === 0}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-600 disabled:opacity-30 transition-colors"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-orange-450 hover:bg-orange-500 disabled:opacity-40 transition-colors"
      >
        {nextLabel}
        {nextLabel !== "Submit" && nextLabel !== "Done ✓" && nextLabel !== "Submitting…" && (
          <ChevronRightIcon className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

// ─── Spoof badge ───────────────────────────────────────────────────────────────
function SpoofBadge({ result }) {
  if (!result) return null;
  if (result.loading) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-orange-450"
        style={{ background: "rgba(255,111,97,0.1)" }}
      >
        <span className="w-3 h-3 rounded-full border-2 border-orange-450 border-t-transparent animate-spin shrink-0" />
        Checking liveness…
      </span>
    );
  }
  if (result.error) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-gray-500 bg-gray-200">
        Liveness check failed
      </span>
    );
  }
  const isReal = result.isReal;
  const pct = result.confidence != null ? Math.round(result.confidence * 100) : null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        background: isReal ? "rgba(59,165,93,0.12)" : "rgba(211,47,47,0.1)",
        color: isReal ? "#3BA55D" : "#D32F2F",
      }}
    >
      {isReal ? (
        <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <ShieldExclamationIcon className="w-3.5 h-3.5 shrink-0" />
      )}
      {isReal ? `Live${pct != null ? ` ${pct}%` : ""} ✓` : "Spoof Detected ✗"}
    </span>
  );
}

// ─── Face match result ─────────────────────────────────────────────────────────
function FaceMatchCard({ result }) {
  if (!result) return null;
  if (result.loading) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-gray-300 bg-slate-50 flex items-center gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-orange-450 border-t-transparent animate-spin shrink-0" />
        <span className="text-xs text-gray-500">Running face match…</span>
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-gray-300 bg-slate-50">
        <p className="text-xs text-gray-400 italic">Face match check failed</p>
      </div>
    );
  }
  const matched = result.matched ?? result.match ?? false;
  const score = result.score ?? result.similarity ?? result.confidence ?? null;
  const pct = score != null ? Math.round(score * 100) : null;
  return (
    <div
      className="mt-3 rounded-xl border overflow-hidden"
      style={{ borderColor: matched ? "rgba(59,165,93,0.4)" : "rgba(211,47,47,0.4)" }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{
          background: matched ? "rgba(59,165,93,0.06)" : "rgba(211,47,47,0.06)",
          borderColor: matched ? "rgba(59,165,93,0.2)" : "rgba(211,47,47,0.2)",
        }}
      >
        <span className="text-xs font-semibold text-gray-650">Face Match</span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: matched ? "rgba(59,165,93,0.15)" : "rgba(211,47,47,0.15)",
            color: matched ? "#3BA55D" : "#D32F2F",
          }}
        >
          {matched ? "Matched ✓" : "Not Matched ✗"}
        </span>
      </div>
      {pct != null && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Similarity</span>
            <span className="text-xs font-bold text-gray-650">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: matched ? "#3BA55D" : "#D32F2F" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OCR result card ───────────────────────────────────────────────────────────
function OCRResultCard({ result }) {
  if (!result) return null;
  if (result.loading) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-gray-300 bg-slate-50 flex items-center gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-orange-450 border-t-transparent animate-spin shrink-0" />
        <span className="text-xs text-gray-500">Extracting text from Aadhaar…</span>
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-gray-300 bg-slate-50">
        <p className="text-xs text-gray-400 italic">OCR failed — could not read text</p>
      </div>
    );
  }
  const text = result.text || result.extractedText || "";
  const fields = result.fields || result.data || {};
  const hasFields = Object.keys(fields).length > 0;
  return (
    <div className="mt-3 rounded-xl border border-gray-300 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-300 bg-slate-50">
        <DocumentTextIcon className="w-4 h-4 text-orange-450 shrink-0" />
        <span className="text-xs font-semibold text-gray-650">OCR — Extracted Text</span>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: "rgba(59,165,93,0.15)", color: "#3BA55D" }}>
          Done
        </span>
      </div>
      {hasFields ? (
        <div className="p-3 space-y-2">
          {Object.entries(fields).map(([key, val]) => (
            <div key={key} className="flex gap-3">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24 shrink-0 pt-0.5">
                {key}
              </span>
              <span className="text-xs text-gray-650 break-all">{String(val)}</span>
            </div>
          ))}
        </div>
      ) : text ? (
        <pre className="p-3 text-xs text-gray-650 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
          {text}
        </pre>
      ) : (
        <p className="p-3 text-xs text-gray-400 italic">No text detected in image</p>
      )}
    </div>
  );
}

// ─── Capture area ──────────────────────────────────────────────────────────────
function CaptureArea({ savedImage, capturedImage, isCapturing, onCapture, captureLabel, customerId, spoofResult, children }) {
  return (
    <div>
      {capturedImage ? (
        <div className="mb-3">
          <img src={capturedImage} alt="Preview" className="w-full rounded-xl object-contain max-h-52 border border-gray-300" />
          <p className="text-xs text-gray-500 text-center mt-1.5">Review before saving</p>
        </div>
      ) : savedImage ? (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckBadgeIcon className="w-4 h-4 text-green-150" />
            <span className="text-xs font-semibold text-green-150">Saved</span>
          </div>
          <img src={savedImage} alt="Saved" className="w-full rounded-xl object-contain max-h-52 border border-gray-300" />
        </div>
      ) : isCapturing ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3 border-2 border-dashed border-gray-300 rounded-xl mb-3">
          <ArrowPathIcon className="w-8 h-8 text-orange-450 animate-spin" />
          <p className="text-sm text-gray-500">Waiting for image…</p>
        </div>
      ) : null}

      {spoofResult && (
        <div className="mb-2">
          <SpoofBadge result={spoofResult} />
        </div>
      )}

      {children}

      <button
        onClick={onCapture}
        disabled={!customerId || isCapturing}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-orange-450 hover:text-orange-450 transition-colors disabled:opacity-40"
      >
        <CameraIcon className="w-5 h-5" />
        {capturedImage ? "Retake" : captureLabel}
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ActionsTab() {
  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");

  // Capture state
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const captureTargetRef = useRef(null); // 'reference' | 'customerPhoto' | 'aadhaarPhoto'
  const imageChunksRef = useRef({});

  // Edit modal
  const [pendingImage, setPendingImage] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalTitle, setEditModalTitle] = useState("Edit Photo");

  // Camera selection
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [customerCameras, setCustomerCameras] = useState([]);

  // AI results (keyed by capture target)
  const [spoofResults, setSpoofResults] = useState({});  // { reference, customerPhoto, aadhaarPhoto }
  const [faceMatchResult, setFaceMatchResult] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);

  const { participants, localParticipant, meetingId } = useMeeting();
  const remoteIds = [...participants.keys()].filter(
    (id) => id !== localParticipant.id && participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  );
  const customerId = remoteIds[0] ?? null;
  const pid = customerId ?? "__none__";

  const {
    geoData,
    customerPhoto, aadhaarPhoto,
    setCustomerPhoto, setAadhaarPhoto,
    submissionStatus, setSubmissionStatus,
    caseId,
    referencePhoto, setReferencePhoto,
    setCustomerSpoofStatus,
    token,
  } = useMeetingAppContext();

  const { publish: triggerCapture } = usePubSub(`IMAGE_CAPTURE_${pid}`, {});
  const { publish: switchCam } = usePubSub(`SWITCH_PARTICIPANT_CAMERA_${pid}`, {});

  usePubSub("DEVICE_INFO", {
    onMessageReceived: ({ payload }) => {
      if (payload?.cameras?.length) setCustomerCameras(payload.cameras);
    },
    onOldMessagesReceived: (messages) => {
      const latest = messages[messages.length - 1];
      if (latest?.payload?.cameras?.length) setCustomerCameras(latest.payload.cameras);
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

          setIsCapturing(false);
          setPendingImage(dataUrl);

          // Run spoof immediately on the raw image
          const target = captureTargetRef.current;
          runSpoofCheck(dataUrl, target);

          // Open edit modal
          const titles = {
            reference: "Edit Reference Face",
            customerPhoto: "Edit Customer Photo",
            aadhaarPhoto: "Edit Aadhaar Card",
          };
          setEditModalTitle(titles[target] || "Edit Photo");
          setShowEditModal(true);

          delete imageChunksRef.current[id];
        }
      } catch (err) {
        console.error("Image reassembly error:", err);
        setIsCapturing(false);
      }
    },
  });

  // ── AI helpers ───────────────────────────────────────────────────────────────

  async function runSpoofCheck(imageBase64, target) {
    if (!token) return;
    setSpoofResults((prev) => ({ ...prev, [target]: { loading: true } }));
    try {
      const raw = await runAntiSpoof({ token, imageBase64 });
      // API returns { spoof_detected: boolean, accuracy: number }
      // Normalise to { isReal, confidence } for SpoofBadge
      const result = { isReal: !raw.spoof_detected, confidence: raw.accuracy };
      setSpoofResults((prev) => ({ ...prev, [target]: result }));
      setCustomerSpoofStatus(result.isReal ? "real" : "spoof");
    } catch {
      setSpoofResults((prev) => ({ ...prev, [target]: { error: true } }));
    }
  }

  async function runFaceMatchCheck(refBase64, targetBase64) {
    if (!token) return;
    setFaceMatchResult({ loading: true });
    try {
      const raw = await runFaceMatch({ token, referenceBase64: refBase64, targetBase64 });
      // API returns { verified: boolean }
      // Normalise to { matched } for FaceMatchCard
      setFaceMatchResult({ matched: raw.verified });
    } catch {
      setFaceMatchResult({ error: true });
    }
  }

  async function runOCRCheck(imageBase64) {
    if (!token) return;
    setOcrResult({ loading: true });
    try {
      const raw = await runOCR({ token, imageBase64 });
      // API returns flat { idType, idNumber, name, dateOfBirth, address, gender, mobileNumber }
      // Normalise to { fields } for OCRResultCard
      setOcrResult({ fields: raw });
    } catch {
      setOcrResult({ error: true });
    }
  }

  // ── Capture ──────────────────────────────────────────────────────────────────

  function handleCapture(target) {
    if (!customerId) { toast.error("Customer not connected yet."); return; }
    captureTargetRef.current = target;
    setIsCapturing(true);
    setCapturedImage(null);
    setFaceMatchResult(null);
    try {
      triggerCapture("IMAGE_CAPTURE", { persist: true }, { senderId: localParticipant.id });
    } catch (err) {
      console.error("Capture error:", err);
      setIsCapturing(false);
    }
  }

  async function handleEditSave(editedImage) {
    const target = captureTargetRef.current;
    setShowEditModal(false);
    setPendingImage(null);

    if (target === "reference") {
      setReferencePhoto(editedImage);
      toast.success("Reference face saved.", { autoClose: 2000 });
    } else {
      setCapturedImage(editedImage);
      if (target === "customerPhoto" && referencePhoto) {
        await runFaceMatchCheck(referencePhoto, editedImage);
      }
      if (target === "aadhaarPhoto") {
        await runOCRCheck(editedImage);
      }
    }
  }

  function handleCameraSelect(camera) {
    setSelectedCamera(camera);
    try {
      switchCam("payload", { persist: true }, {
        cameraDeviceId: camera.deviceId,
        cameraLabel: camera.label,
        isChangeWebcam: true,
      });
    } catch (err) {
      console.error("Camera switch error:", err);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmissionStatus("submitting");
    try {
      await submitDocuments({
        caseId,
        geoData,
        patientName: name,
        patientAge: age,
        customerPhotoBase64: customerPhoto,
        aadhaarPhotoBase64: aadhaarPhoto,
        sessionId: meetingId,
      });
      setSubmissionStatus("success");
      toast.success("Documents submitted successfully.", { autoClose: 3000 });
    } catch (err) {
      console.error("Submit error:", err);
      setSubmissionStatus("error");
      toast.error("Submission failed. Please retry.");
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function goNext() {
    if (activeStep === 2) {
      if (capturedImage) { setCustomerPhoto(capturedImage); setCapturedImage(null); }
    } else if (activeStep === 3) {
      if (capturedImage) { setAadhaarPhoto(capturedImage); setCapturedImage(null); }
    } else if (activeStep === 4) {
      handleSubmit();
      return;
    }
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setCapturedImage(null);
    setIsCapturing(false);
    setActiveStep((s) => Math.max(s - 1, 0));
  }

  function canGoNext() {
    if (activeStep === 1) return name.trim().length > 0 && age.trim().length > 0;
    if (activeStep === 2) return !!capturedImage || !!customerPhoto;
    if (activeStep === 3) return !!capturedImage || !!aadhaarPhoto;
    if (activeStep === 4) return submissionStatus !== "submitting" && submissionStatus !== "success";
    return true;
  }

  function getNextLabel() {
    if ((activeStep === 2 || activeStep === 3) && capturedImage) return "Save & Next";
    if (activeStep === 4) {
      if (submissionStatus === "success") return "Done ✓";
      if (submissionStatus === "submitting") return "Submitting…";
      return "Submit";
    }
    return "Next";
  }

  const currentSpoofResult = spoofResults[captureTargetRef.current];

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        <StepBar active={activeStep} />

        {/* Scrollable step content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 0: Greeting ────────────────────────────────────────────── */}
          {activeStep === 0 && (
            <div className="p-6">
              <h3 className="text-base font-bold text-gray-650 mb-1">Welcome the Customer</h3>
              <p className="text-sm text-gray-500 mb-5">Greet and confirm identity before proceeding.</p>
              <ul className="space-y-3">
                {[
                  "Introduce yourself as the medical examiner",
                  "Confirm the customer's name and date of birth",
                  "Ensure the environment is quiet and well-lit",
                  "Ask the customer to sit facing the camera",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-orange-450 bg-orange-450/10">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Step 1: Patient Details + Reference Face ─────────────────────── */}
          {activeStep === 1 && (
            <div className="p-6">
              <h3 className="text-base font-bold text-gray-650 mb-1">Patient Details</h3>
              <p className="text-sm text-gray-500 mb-5">Fill in basic info and capture a reference face for identity verification.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter patient's full name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-650 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-450/30 focus:border-orange-450 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Enter age"
                    min="1"
                    max="120"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-650 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-450/30 focus:border-orange-450 transition-colors"
                  />
                </div>
              </div>

              {/* Reference face capture */}
              <div className="mt-5 pt-5 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <FaceSmileIcon className="w-4 h-4 text-orange-450" />
                  <span className="text-xs font-bold text-gray-650 uppercase tracking-wide">Reference Face</span>
                  <span className="text-[10px] text-gray-400 italic">(optional — enables face match)</span>
                </div>

                {referencePhoto ? (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckBadgeIcon className="w-4 h-4 text-green-150" />
                      <span className="text-xs font-semibold text-green-150">Reference saved</span>
                      {spoofResults.reference && (
                        <span className="ml-auto">
                          <SpoofBadge result={spoofResults.reference} />
                        </span>
                      )}
                    </div>
                    <img src={referencePhoto} alt="Reference" className="w-full rounded-xl object-contain max-h-40 border border-gray-300" />
                  </div>
                ) : isCapturing && captureTargetRef.current === "reference" ? (
                  <div className="flex flex-col items-center justify-center py-7 gap-3 border-2 border-dashed border-gray-300 rounded-xl mb-3">
                    <ArrowPathIcon className="w-7 h-7 text-orange-450 animate-spin" />
                    <p className="text-sm text-gray-400">Waiting for face capture…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 border-2 border-dashed border-gray-200 rounded-xl mb-3">
                    <UserCircleIcon className="w-10 h-10 text-gray-300" />
                    <p className="text-xs text-gray-400">No reference face captured</p>
                  </div>
                )}

                {spoofResults.reference && !referencePhoto && (
                  <div className="mb-2">
                    <SpoofBadge result={spoofResults.reference} />
                  </div>
                )}

                <button
                  onClick={() => handleCapture("reference")}
                  disabled={!customerId || isCapturing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-orange-450 hover:text-orange-450 transition-colors disabled:opacity-40"
                >
                  <CameraIcon className="w-5 h-5" />
                  {referencePhoto ? "Retake Reference Face" : "Capture Reference Face"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Customer Photo + Face Match ───────────────────────────── */}
          {activeStep === 2 && (
            <div className="p-6">
              <h3 className="text-base font-bold text-gray-650 mb-1">Customer Photo</h3>
              <p className="text-sm text-gray-500 mb-4">
                Ask the customer to face the camera. Each capture will{" "}
                {referencePhoto ? "auto-run face match + " : ""}check liveness.
              </p>

              <CaptureArea
                savedImage={customerPhoto}
                capturedImage={capturedImage}
                isCapturing={isCapturing && captureTargetRef.current === "customerPhoto"}
                onCapture={() => handleCapture("customerPhoto")}
                captureLabel="Capture Photo"
                customerId={customerId}
                spoofResult={spoofResults.customerPhoto}
              >
                {/* Face match result */}
                <FaceMatchCard result={faceMatchResult} />

                {/* Manual face match button */}
                {capturedImage && referencePhoto && !faceMatchResult?.loading && (
                  <button
                    onClick={() => runFaceMatchCheck(referencePhoto, capturedImage)}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-orange-450 border border-orange-450/30 hover:bg-orange-450/5 transition-colors"
                  >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    Check Face Match
                  </button>
                )}

                {!referencePhoto && (
                  <p className="mt-2 text-xs text-gray-400 italic text-center">
                    No reference face — go back to Details to capture one for face matching.
                  </p>
                )}
              </CaptureArea>
            </div>
          )}

          {/* ── Step 3: Aadhaar + OCR ─────────────────────────────────────────── */}
          {activeStep === 3 && (
            <div className="p-6">
              <h3 className="text-base font-bold text-gray-650 mb-1">Aadhaar Card</h3>
              <p className="text-sm text-gray-500 mb-4">
                Ask the customer to hold their Aadhaar clearly. OCR will auto-extract text.
              </p>

              {/* Camera picker */}
              {customerCameras.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Camera ({customerCameras.length} available)
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {customerCameras.map((cam, i) => {
                      const isActive = selectedCamera?.deviceId === cam.deviceId;
                      return (
                        <button
                          key={cam.deviceId || i}
                          onClick={() => handleCameraSelect(cam)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border text-left ${
                            isActive
                              ? "bg-orange-450 border-orange-450 text-white"
                              : "bg-white border-gray-300 text-gray-600 hover:border-orange-450 hover:text-orange-450"
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isActive ? "bg-white text-orange-450" : "bg-gray-100 text-gray-500"}`}>
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate">{cam.label}</span>
                          {isActive && <span className="text-[9px] font-bold uppercase tracking-wider shrink-0">Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <CaptureArea
                savedImage={aadhaarPhoto}
                capturedImage={capturedImage}
                isCapturing={isCapturing && captureTargetRef.current === "aadhaarPhoto"}
                onCapture={() => handleCapture("aadhaarPhoto")}
                captureLabel="Capture Aadhaar"
                customerId={customerId}
                spoofResult={spoofResults.aadhaarPhoto}
              />

              {/* OCR result */}
              <OCRResultCard result={ocrResult} />

              {/* Re-run OCR */}
              {capturedImage && !ocrResult?.loading && (
                <button
                  onClick={() => runOCRCheck(capturedImage)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-orange-450 border border-orange-450/30 hover:bg-orange-450/5 transition-colors"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  Re-run OCR
                </button>
              )}
            </div>
          )}

          {/* ── Step 4: Review & Submit ───────────────────────────────────────── */}
          {activeStep === 4 && (
            <div className="p-6 space-y-4">
              <h3 className="text-base font-bold text-gray-650 mb-1">Review & Submit</h3>
              <p className="text-sm text-gray-500 mb-2">Verify everything before submitting.</p>

              <div className="bg-slate-50 rounded-xl p-4 border border-gray-300">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Patient</p>
                <p className="text-sm font-semibold text-gray-650">{name || <span className="text-gray-400 font-normal italic">Not entered</span>}</p>
                <p className="text-xs text-gray-500 mt-0.5">Age: {age || <span className="italic">—</span>}</p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-gray-300">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Location</p>
                {geoData ? (
                  <>
                    <p className="text-xs font-mono text-gray-650">
                      {geoData.latitude?.toFixed(5)}, {geoData.longitude?.toFixed(5)}
                    </p>
                    {geoData.address && (
                      <p className="text-xs text-gray-500 mt-1 leading-snug">{geoData.address}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">Not captured</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-gray-300">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Photo</p>
                  {customerPhoto ? (
                    <img src={customerPhoto} alt="Customer" className="w-full rounded-lg object-cover max-h-28" />
                  ) : (
                    <p className="text-xs text-gray-400 italic">Not captured</p>
                  )}
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-gray-300">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Aadhaar</p>
                  {aadhaarPhoto ? (
                    <img src={aadhaarPhoto} alt="Aadhaar" className="w-full rounded-lg object-cover max-h-28" />
                  ) : (
                    <p className="text-xs text-gray-400 italic">Not captured</p>
                  )}
                </div>
              </div>

              {/* AI summary */}
              {(spoofResults.customerPhoto || spoofResults.aadhaarPhoto || faceMatchResult) && (
                <div className="bg-slate-50 rounded-xl p-4 border border-gray-300">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">AI Checks</p>
                  <div className="space-y-2">
                    {spoofResults.customerPhoto && !spoofResults.customerPhoto.loading && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Photo liveness</span>
                        <SpoofBadge result={spoofResults.customerPhoto} />
                      </div>
                    )}
                    {spoofResults.aadhaarPhoto && !spoofResults.aadhaarPhoto.loading && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Aadhaar liveness</span>
                        <SpoofBadge result={spoofResults.aadhaarPhoto} />
                      </div>
                    )}
                    {faceMatchResult && !faceMatchResult.loading && !faceMatchResult.error && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Face match</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: (faceMatchResult.matched ?? faceMatchResult.match) ? "rgba(59,165,93,0.12)" : "rgba(211,47,47,0.1)",
                            color: (faceMatchResult.matched ?? faceMatchResult.match) ? "#3BA55D" : "#D32F2F",
                          }}
                        >
                          {(faceMatchResult.matched ?? faceMatchResult.match) ? "Matched ✓" : "Not Matched ✗"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {submissionStatus === "success" && (
                <div className="flex items-center gap-2.5 p-3 bg-green-350 rounded-xl border border-green-450">
                  <CheckBadgeIcon className="w-5 h-5 text-green-150 shrink-0" />
                  <p className="text-sm font-medium text-green-150">Documents submitted successfully.</p>
                </div>
              )}
              {submissionStatus === "error" && (
                <p className="text-xs text-red-150 text-center">Submission failed. Please try again.</p>
              )}
            </div>
          )}
        </div>

        <NavRow
          step={activeStep}
          onBack={goBack}
          onNext={goNext}
          nextLabel={getNextLabel()}
          nextDisabled={!canGoNext() || submissionStatus === "submitting" || submissionStatus === "success"}
        />
      </div>

      {/* Photo edit modal */}
      <PhotoEditModal
        open={showEditModal}
        imageSrc={pendingImage}
        title={editModalTitle}
        onSave={handleEditSave}
        onClose={() => {
          setShowEditModal(false);
          setPendingImage(null);
          setIsCapturing(false);
        }}
      />
    </>
  );
}
