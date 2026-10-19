import React, { useState } from "react";
import { TRIGGER_TYPES } from "../hooks/useBandwidthVideoSaver";

// Testing control for the auto video-off-on-limitation behaviour. Rendered for
// doctor and patient alike so either side can drive a test. Collapsed to a
// single pill until opened.
const PHASE_LABEL = {
  idle: { text: "Idle", color: "#40A954" },
  saving: { text: "Doctor's video off", color: "#FF5D5D" },
  pending: { text: "Waiting to restore", color: "#FF900C" },
};

export default function BandwidthSaverPanel({
  enabled,
  onEnabledChange,
  triggers,
  onTriggersChange,
  restoreDelayMs,
  onRestoreDelayChange,
  phase,
  activeTypes = [],
  role,
}) {
  const [open, setOpen] = useState(false);
  const badge = PHASE_LABEL[phase] || PHASE_LABEL.idle;

  const toggleTrigger = (type) => {
    onTriggersChange(
      triggers.includes(type) ? triggers.filter((t) => t !== type) : [...triggers, type]
    );
  };

  return (
    <div style={{ position: "absolute", top: 68, right: 12, zIndex: 70, pointerEvents: "auto" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(27,27,30,0.96)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
          padding: "6px 10px", color: "#fff", fontSize: 12, cursor: "pointer",
        }}
        title="Bandwidth saver (testing)"
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: enabled ? badge.color : "#6b6b73" }} />
        <span style={{ opacity: 0.9 }}>Saver</span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 8, width: 260, background: "rgba(27,27,30,0.97)",
            backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Drop doctor video on patient trouble</span>
          </label>

          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.4)", fontSize: 10, lineHeight: "14px" }}>
            {role === "doctor"
              ? "The patient's side decides; your camera follows."
              : "Your connection is watched; the doctor's camera follows."}
          </div>

          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", fontSize: 11 }}>Status</div>
          <div style={{ color: enabled ? badge.color : "#6b6b73", fontSize: 12, fontWeight: 600 }}>
            {enabled ? badge.text : "Disabled"}
            {activeTypes.length > 0 && (
              <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 400 }}> · {activeTypes.join(", ")}</span>
            )}
          </div>

          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", fontSize: 11 }}>Restore delay</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <input
              type="range" min={0} max={15000} step={500}
              value={restoreDelayMs}
              onChange={(e) => onRestoreDelayChange(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ color: "#fff", fontSize: 12, minWidth: 42, textAlign: "right" }}>
              {(restoreDelayMs / 1000).toFixed(1)}s
            </span>
          </div>

          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
            Trigger on {role === "doctor" ? "(patient-side)" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            {TRIGGER_TYPES.map((type) => (
              <label key={type} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={triggers.includes(type)} onChange={() => toggleTrigger(type)} />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
