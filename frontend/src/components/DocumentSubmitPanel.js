import React from "react";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import { submitDocuments } from "../api";
import { useMeeting } from "@videosdk.live/react-sdk";
import { toast } from "react-toastify";

const DocumentSubmitPanel = ({ panelHeight }) => {
  const { geoData, customerPhoto, aadhaarPhoto, submissionStatus, setSubmissionStatus, caseId } =
    useMeetingAppContext();
  const { meetingId } = useMeeting();

  const handleSubmit = async () => {
    if (!geoData && !customerPhoto && !aadhaarPhoto) {
      toast.error("Nothing captured yet.");
      return;
    }
    setSubmissionStatus("submitting");
    try {
      await submitDocuments({
        caseId,
        geoData,
        customerPhotoBase64: customerPhoto,
        aadhaarPhotoBase64: aadhaarPhoto,
        sessionId: meetingId,
      });
      setSubmissionStatus("success");
      toast.success("Documents submitted successfully.", { autoClose: 3000 });
    } catch (err) {
      console.error("Submit failed:", err);
      setSubmissionStatus("error");
      toast.error("Submission failed. Please retry.", { autoClose: 3000 });
    }
  };

  return (
    <div
      className="flex flex-col bg-gray-750 overflow-y-auto p-4 gap-4"
      style={{ height: panelHeight }}
    >
      {/* Geo Data */}
      <div className="bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Location</p>
        {geoData ? (
          <div className="text-white text-sm space-y-0.5">
            <p>Lat: {geoData.latitude?.toFixed(6)}</p>
            <p>Lng: {geoData.longitude?.toFixed(6)}</p>
            {geoData.accuracy && <p className="text-gray-400 text-xs">±{Math.round(geoData.accuracy)}m</p>}
            {typeof geoData.address === "string" && geoData.address && (
              <p className="text-gray-300 text-xs mt-1">{geoData.address}</p>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Not captured</p>
        )}
      </div>

      {/* Customer Photo */}
      <div className="bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Customer Photo</p>
        {customerPhoto ? (
          <img src={customerPhoto} alt="Customer" className="w-full max-h-40 object-contain rounded" />
        ) : (
          <p className="text-gray-500 text-sm">Not captured</p>
        )}
      </div>

      {/* Aadhaar Card */}
      <div className="bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Aadhaar Card</p>
        {aadhaarPhoto ? (
          <img src={aadhaarPhoto} alt="Aadhaar" className="w-full max-h-40 object-contain rounded" />
        ) : (
          <p className="text-gray-500 text-sm">Not captured</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submissionStatus === "submitting" || submissionStatus === "success"}
        className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
          submissionStatus === "success"
            ? "bg-green-700 text-white cursor-default"
            : submissionStatus === "submitting"
            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
            : "bg-orange-450 hover:bg-orange-500 text-white"
        }`}
      >
        {submissionStatus === "success"
          ? "Submitted"
          : submissionStatus === "submitting"
          ? "Submitting..."
          : "Submit to Tata 1mg"}
      </button>

      {submissionStatus === "error" && (
        <p className="text-red-400 text-xs text-center">Submission failed. Try again.</p>
      )}
    </div>
  );
};

export default DocumentSubmitPanel;
