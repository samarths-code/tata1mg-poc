import React, { useState, useEffect } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useMeetingStore } from "../../store/meetingStore";
import SideBySideLayout from "../SideBySideLayout";
import { BottomBar } from "../../meeting/components/BottomBar";
import DoctorTopBar from "./DoctorTopBar";
import useIsMobile from "../../hooks/useIsMobile";
import { ConnectionDetailsPanel } from "./VerificationDrawer";

// Figma pill drawer: py-5 (20×2) + 32px buttons = ~72px; 80 gives a small gap above pill
const bottomBarHeight = 80;

export default function DoctorView() {
  const { participants, localParticipant } = useMeeting();
  const remoteIds = [...participants.keys()].filter(
    (id) => id !== localParticipant.id && participants.get(id)?.displayName?.toLowerCase() !== "recorder"
  );
  const customerId = remoteIds[0] ?? null;

  // Narrow selectors — DoctorView only re-renders when these specific slices change.
  const geoData = useMeetingStore((s) => s.geoData);
  const caseId = useMeetingStore((s) => s.caseId);
  const isAudioOnly = useMeetingStore((s) => s.isAudioOnly);

  // Connection Details: always open on desktop; a full-screen toggle on mobile.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Device info for the Connection Details panel ───────────────────────────
  const [deviceInfo, setDeviceInfo] = useState(null);

  const [geoFailed, setGeoFailed] = useState(false);
  // Clear failed flag once real geo data arrives
  useEffect(() => { if (geoData) setGeoFailed(false); }, [geoData]);

  const { publish: publishGeoRetry } = usePubSub("GEO_RETRY", {});

  usePubSub("GEO_FAILED", {
    onMessageReceived: () => setGeoFailed(true),
    onOldMessagesReceived: (msgs) => { if (msgs.length > 0) setGeoFailed(true); },
  });

  usePubSub("DEVICE_INFO", {
    onMessageReceived: ({ payload }) => {
      setDeviceInfo((prev) => (prev ? { ...prev, ...payload } : payload));
    },
    onOldMessagesReceived: (messages) => {
      const latest = messages[messages.length - 1];
      if (latest?.payload) setDeviceInfo(latest.payload);
    },
  });


  // ── Render ─────────────────────────────────────────────────────────────────
  const isMobile = useIsMobile();
  // On mobile, step bar sits above the bottom pill; reserve space below video
  const stepBarHeight = isMobile ? 52 : 0; // step pill (~32px) + gap (~20px)
  const videoBottom = bottomBarHeight + stepBarHeight;

  const connectionPanel = (
    <ConnectionDetailsPanel
      deviceInfo={deviceInfo}
      geoData={geoData}
      geoFailed={geoFailed}
      hideCameras={isAudioOnly}
      onRequestLocation={() => publishGeoRetry("GEO_RETRY", { persist: false }, {})}
      onClose={isMobile ? () => setDrawerOpen(false) : undefined}
    />
  );

  return (
    <div className="flex flex-col h-full bg-[#1b1b1e] relative overflow-hidden">
      <DoctorTopBar
        meetingTitle={new URLSearchParams(window.location.search).get("meetingTitle") || ""}
        caseId={caseId}
      />

      <div className="flex-1 flex relative overflow-hidden">
        {/* Video stage — fills remaining flex space */}
        <div className="relative flex-1">
          {/* Doctor (self) left, patient right — stops above step bar (mobile) or bottom bar (desktop) */}
          <div className="absolute inset-x-0 top-0 flex" style={{ bottom: videoBottom }}>
            <SideBySideLayout
              tiles={[localParticipant.id, customerId]}
              waitingText="Waiting for patient to join…"
            />
          </div>
        </div>

        {/* Connection details — always-open side panel on desktop, full-screen toggle on mobile */}
        {isMobile ? (
          drawerOpen && <div className="fixed inset-0 z-50">{connectionPanel}</div>
        ) : (
          <div className="shrink-0 h-full" style={{ paddingBottom: bottomBarHeight }}>
            {connectionPanel}
          </div>
        )}
      </div>

      {/* Mobile: opens the full-screen Connection Details panel */}
      {isMobile && (
        <div className="absolute left-4 right-4 z-20" style={{ bottom: bottomBarHeight + 8 }}>
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-full flex items-center justify-center px-3 py-[6px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded text-white text-sm font-medium"
          >
            Connection Details
          </button>
        </div>
      )}

      {/* Floating control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <BottomBar
          bottomBarHeight={bottomBarHeight}
          customerId={customerId}
          onShowConnectionDetails={() => setDrawerOpen(true)}
        />
      </div>
    </div>
  );
}
