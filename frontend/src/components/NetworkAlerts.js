import React, { useRef, useState } from "react";

// Stacked connection banners. Sources:
//   • the SDK's onQualityLimitation (bandwidth / congestion / cpu)
//   • our own low-send-bitrate watch, for this side and for the other side
// Kept as one component so two warnings never overlap on screen.

const TONE = {
  warn:  { accent: "#FF900C" }, // yellow-150
  error: { accent: "#FF5D5D" }, // orange-350
  ok:    { accent: "#40A954" }, // green-250
};

function WifiOffIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill={color} stroke="none" />
    </svg>
  );
}

function CheckCircleIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CpuIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

const ICONS = { wifi: WifiOffIcon, cpu: CpuIcon, ok: CheckCircleIcon };

const SWIPE_PX = 48;       // drag past this to dismiss
const DOUBLE_TAP_MS = 300;

function Alert({ tone = "warn", icon = "wifi", title, body, onDismiss }) {
  const accent = (TONE[tone] || TONE.warn).accent;
  const Icon = ICONS[icon] || WifiOffIcon;
  const startX = useRef(null);
  const lastTap = useRef(0);
  const [dx, setDx] = useState(0);

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e) => {
    if (startX.current != null) setDx(e.touches[0].clientX - startX.current);
  };
  const onTouchEnd = () => {
    startX.current = null;
    if (Math.abs(dx) > SWIPE_PX) onDismiss?.();
    else setDx(0);
  };
  // Works for both mouse and touch, so no separate onDoubleClick.
  const onPointerUp = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) onDismiss?.();
    lastTap.current = now;
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onPointerUp={onPointerUp}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: "rgba(27,27,30,0.96)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: "11px 14px",
        maxWidth: 380,
        minWidth: 260,
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        animation: dx ? "none" : "nqp-slidein 0.22s ease-out",
        pointerEvents: "auto",
        touchAction: "pan-y",
        cursor: "pointer",
        transform: `translateX(${dx}px)`,
        opacity: Math.max(0, 1 - Math.abs(dx) / 160),
        transition: dx ? "none" : "transform 0.18s ease, opacity 0.18s ease",
      }}
    >
      <div style={{ marginTop: 1, flexShrink: 0 }}><Icon color={accent} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: accent, fontWeight: 600, fontSize: 13, lineHeight: "18px", marginBottom: 3 }}>
          {title}
        </p>
        <p style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, lineHeight: "17px" }}>{body}</p>
      </div>
    </div>
  );
}

// Swipe sideways or double-tap a banner to dismiss it. A dismissed id is
// forgotten once that alert clears, so the same condition can warn again later.
export default function NetworkAlerts({ alerts = [] }) {
  const [dismissed, setDismissed] = useState(() => new Set());

  const live = new Set(alerts.map((a) => a.id));
  let pruned = null;
  dismissed.forEach((id) => {
    if (!live.has(id)) (pruned = pruned || new Set(dismissed)).delete(id);
  });
  if (pruned) setDismissed(pruned);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 68,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes nqp-slidein {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {visible.map((a) => (
        <Alert
          key={a.id}
          tone={a.tone}
          icon={a.icon}
          title={a.title}
          body={a.body}
          onDismiss={() => setDismissed((prev) => new Set(prev).add(a.id))}
        />
      ))}
    </div>
  );
}
