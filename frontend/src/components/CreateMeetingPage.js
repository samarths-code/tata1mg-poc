import React, { useState } from "react";
import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { createMeetingWithCredentials } from "../api";
import Tata1mgLogo from "./Tata1mgLogo";

export default function CreateMeetingPage() {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [links, setLinks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState({ doctor: false, patient: false });

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const { roomId, doctor, patient } = await createMeetingWithCredentials();

      const base = window.location.origin;
      const titleParam = meetingTitle.trim()
        ? `&meetingTitle=${encodeURIComponent(meetingTitle.trim())}`
        : "";

      const doctorLink =
        `${base}?meetingId=${roomId}&mode=Doctor` +
        `&participantId=${encodeURIComponent(doctor.participantId)}` +
        `&token=${encodeURIComponent(doctor.token)}` +
        titleParam;

      const patientLink =
        `${base}?meetingId=${roomId}&mode=Patient` +
        `&participantId=${encodeURIComponent(patient.participantId)}` +
        `&token=${encodeURIComponent(patient.token)}` +
        titleParam;

      setLinks({ doctorLink, patientLink });
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

  const reset = () => {
    setLinks(null);
    setMeetingTitle("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="px-[30px] py-[22px] flex items-center">
        <Tata1mgLogo height={36} dark />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Create a Meeting</h2>
          <p className="text-gray-500 text-sm mb-7">
            Generate secure, pre-authenticated links for doctor and patient
          </p>

          {!links ? (
            <>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Meeting Title <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Monthly Health Consultation"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-450 transition-colors placeholder-gray-400"
                />
              </div>

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
                link={links.doctorLink}
                isCopied={copied.doctor}
                onCopy={() => copyLink(links.doctorLink, "doctor")}
              />
              <LinkRow
                label="Patient Link"
                link={links.patientLink}
                isCopied={copied.patient}
                onCopy={() => copyLink(links.patientLink, "patient")}
              />
              <button
                onClick={reset}
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
