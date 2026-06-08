import React, { useEffect, useRef, useState, useCallback } from "react";

// ── Per-type config ───────────────────────────────────────────────────────────
const DETECTED_CONFIG = {
  bandwidth: {
    title: "Weak Connection",
    body: "Your internet is slow. Video quality has been reduced automatically.",
    accent: "#FF900C",          // yellow-150
    bg: "rgba(27,27,30,0.96)",
    leftBorder: "#FF900C",
  },
  congestion: {
    title: "Network Congestion",
    body: "Heavy network traffic is affecting your call quality.",
    accent: "#FF900C",
    bg: "rgba(27,27,30,0.96)",
    leftBorder: "#FF900C",
  },
  cpu: {
    title: "Device Overloaded",
    body: "Your device is under heavy load. Video quality has been reduced.",
    accent: "#FF5D5D",          // orange-350
    bg: "rgba(27,27,30,0.96)",
    leftBorder: "#FF5D5D",
  },
};

const RESOLVED_CONFIG = {
  title: "Connection Restored",
  body: "Network quality is back to normal.",
  accent: "#40A954",            // green-250
  bg: "rgba(27,27,30,0.96)",
  leftBorder: "#40A954",
};

// ── Icons ─────────────────────────────────────────────────────────────────────
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
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NetworkQualityPopup({ limitation }) {
  // limitation: { type: 'bandwidth'|'congestion'|'cpu', state: 'detected'|'resolved' } | null
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState(null);
  const resolvedTimerRef = useRef(null);

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!limitation) return;

    if (resolvedTimerRef.current) {
      clearTimeout(resolvedTimerRef.current);
      resolvedTimerRef.current = null;
    }

    if (limitation.state === "detected") {
      setDisplayed({ type: limitation.type, state: "detected" });
      setVisible(true);
    } else if (limitation.state === "resolved") {
      setDisplayed({ type: limitation.type, state: "resolved" });
      setVisible(true);
      resolvedTimerRef.current = setTimeout(() => setVisible(false), 4000);
    }

    return () => {
      if (resolvedTimerRef.current) clearTimeout(resolvedTimerRef.current);
    };
  }, [limitation]);

  if (!visible || !displayed) return null;

  const isResolved = displayed.state === "resolved";
  const cfg = isResolved
    ? RESOLVED_CONFIG
    : (DETECTED_CONFIG[displayed.type] || DETECTED_CONFIG.bandwidth);

  const Icon = isResolved
    ? () => <CheckCircleIcon color={cfg.accent} />
    : displayed.type === "cpu"
    ? () => <CpuIcon color={cfg.accent} />
    : () => <WifiOffIcon color={cfg.accent} />;

  return (
    <div
      style={{
        position: "absolute",
        top: 68,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: cfg.bg,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${cfg.leftBorder}`,
        borderRadius: 10,
        padding: "11px 14px 11px 14px",
        maxWidth: 360,
        minWidth: 260,
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        pointerEvents: "auto",
        animation: "nqp-slidein 0.22s ease-out",
      }}
    >
      <style>{`
        @keyframes nqp-slidein {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div style={{ marginTop: 1, flexShrink: 0 }}>
        <Icon />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color: cfg.accent,
          fontWeight: 600,
          fontSize: 13,
          lineHeight: "18px",
          marginBottom: 3,
        }}>
          {cfg.title}
        </p>
        <p style={{
          color: "rgba(255,255,255,0.68)",
          fontSize: 12,
          lineHeight: "17px",
        }}>
          {cfg.body}
        </p>
      </div>

      {/* Dismiss button — only for detected (resolved auto-hides) */}
      {!isResolved && (
        <button
          onClick={dismiss}
          aria-label="Dismiss network warning"
          style={{
            flexShrink: 0,
            marginTop: 1,
            color: "rgba(255,255,255,0.4)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
          }}
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}
