import React, { useState } from "react";
import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { createMeeting } from "../api";

export default function CreateMeetingPage() {
  const [meetingId, setMeetingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState({ doctor: false, patient: false });

  const base = window.location.origin;
  const doctorLink = meetingId ? `${base}?meetingId=${meetingId}&mode=Doctor` : "";
  const patientLink = meetingId ? `${base}?meetingId=${meetingId}&mode=Patient` : "";

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const id = await createMeeting();
      setMeetingId(id);
    } catch (e) {
      setError(e.message || "Failed to create meeting");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (link, role) => {
    navigator.clipboard.writeText(link);
    setCopied((prev) => ({ ...prev, [role]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [role]: false })), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-orange-450 px-5 py-3 flex items-center gap-3 shrink-0 shadow-md">
        <img
          src="https://play-lh.googleusercontent.com/yjbAu08_Ahes38IEMV8slP91zgjh2mdh5xpZefvcbYuZxR8O7FZFderRn2Ivaz0uR2Lw"
          alt="Tata 1mg"
          className="w-9 h-9 rounded-xl object-contain"
        />
        <div className="leading-none">
          <p className="text-white font-bold text-sm">Tata 1mg</p>
          <p className="text-white/70 text-xs mt-0.5">Video MER</p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Create a Meeting</h2>
          <p className="text-gray-500 text-sm mb-7">
            Generate secure links for doctor and patient
          </p>

          {!meetingId ? (
            <>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-orange-450 hover:bg-orange-500 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-3 rounded-xl font-semibold transition-colors"
              >
                {loading ? "Creating…" : "Create Meeting"}
              </button>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            </>
          ) : (
            <div className="flex flex-col gap-5">
              <LinkRow
                label="Doctor Link"
                link={doctorLink}
                isCopied={copied.doctor}
                onCopy={() => copyLink(doctorLink, "doctor")}
              />
              <LinkRow
                label="Patient Link"
                link={patientLink}
                isCopied={copied.patient}
                onCopy={() => copyLink(patientLink, "patient")}
              />
              <button
                onClick={() => setMeetingId("")}
                className="w-full border-2 border-orange-450 text-orange-450 hover:bg-orange-50 px-4 py-3 rounded-xl font-semibold transition-colors mt-1"
              >
                Create Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkRow({ label, link, isCopied, onCopy }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
        <p className="text-gray-800 text-xs font-mono flex-1 truncate">{link}</p>
        <button onClick={onCopy} className="shrink-0">
          {isCopied ? (
            <CheckIcon className="h-5 w-5 text-green-500" />
          ) : (
            <ClipboardIcon className="h-5 w-5 text-orange-450" />
          )}
        </button>
      </div>
    </div>
  );
}
