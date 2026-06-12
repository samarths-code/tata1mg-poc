/**
 * DisableLinkDialog — lets the PPMC doctor permanently deactivate the meeting ID.
 * Shown only when flowConfig.enableDisableLink is true and the participant is a doctor.
 * MER flow is unaffected (enableDisableLink: false).
 */
import React, { useState } from "react";
import { toast } from "react-toastify";
import { disableMeeting } from "../../api";
import { appParams } from "../../appParams";

const DisableLinkDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const handleDisable = async () => {
    setLoading(true);
    try {
      await disableMeeting(appParams.meetingId);
      setDisabled(true);
      setOpen(false);
      toast.success("Meeting link disabled. Both links are now permanently inactive.", {
        position: "bottom-left",
        autoClose: 6000,
        hideProgressBar: true,
        closeButton: true,
        theme: "dark",
      });
    } catch (err) {
      toast.error(err?.message || "Failed to disable link. Try again.", {
        position: "bottom-left",
        autoClose: 5000,
        hideProgressBar: true,
        closeButton: true,
        theme: "dark",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "Link already disabled" : "Disable meeting link"}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          disabled
            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
            : "bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30"
        }`}
      >
        {disabled ? "Link Disabled" : "Disable Link"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => !loading && setOpen(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <p className="text-lg font-semibold text-gray-800 mb-2">Disable Meeting Link?</p>
            <p className="text-sm text-gray-500 mb-6">
              Both the doctor and patient links will <strong>permanently stop working</strong>.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-60"
              >
                {loading ? "Disabling…" : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DisableLinkDialog;
