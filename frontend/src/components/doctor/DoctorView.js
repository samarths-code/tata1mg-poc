import React, { useState, useRef, useEffect } from "react";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import { useMeetingStore } from "../../store/meetingStore";
import { MemoizedParticipant } from "../ParticipantView";
import { BottomBar } from "../../meeting/components/BottomBar";
import DoctorTopBar, { DoctorStepBar } from "./DoctorTopBar";
import useIsMobile from "../../hooks/useIsMobile";
import { ConnectionDetailsPanel } from "./VerificationDrawer";
import { MicrophoneIcon, VideoCameraIcon } from "@heroicons/react/24/outline";

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

  // ── Step + drawer state (only Step 1: Connection Verification) ─────────────
  const [completedSteps, setCompletedSteps] = useState([]);
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

  // Restore persisted verification progress on (re)load.
  const { publish: publishStep } = usePubSub("VERIFICATION_STEP", {
    onOldMessagesReceived: (messages) => {
      const last = messages[messages.length - 1];
      if (Array.isArray(last?.payload?.completed)) setCompletedSteps(last.payload.completed);
    },
  });

  // Skip the first (mount) publish so the default state doesn't overwrite the
  // persisted progress before onOldMessagesReceived restores it.
  const firstStepPublishRef = useRef(true);
  useEffect(() => {
    if (firstStepPublishRef.current) { firstStepPublishRef.current = false; return; }
    try {
      publishStep("step", { persist: true }, { step: 1, completed: completedSteps });
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps]);

  usePubSub("DEVICE_INFO", {
    onMessageReceived: ({ payload }) => {
      setDeviceInfo((prev) => (prev ? { ...prev, ...payload } : payload));
    },
    onOldMessagesReceived: (messages) => {
      const latest = messages[messages.length - 1];
      if (latest?.payload) setDeviceInfo(latest.payload);
    },
  });

  function approveStep1() {
    setCompletedSteps((s) => (s.includes(1) ? s : [...s, 1]));
    setDrawerOpen(false);
  }

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
      onClose={() => setDrawerOpen(false)}
      onNextStep={completedSteps.includes(1) ? null : approveStep1}
    />
  );

  return (
    <div className="flex flex-col h-full bg-[#1b1b1e] relative overflow-hidden">
      <DoctorTopBar
        meetingTitle={new URLSearchParams(window.location.search).get("meetingTitle") || ""}
        caseId={caseId}
        completedSteps={completedSteps}
        onStepClick={() => setDrawerOpen(true)}
      />

      <div className="flex-1 flex relative overflow-hidden">
        {/* Video stage — fills remaining flex space */}
        <div className="relative flex-1">
          {/* Client tile — stops above step bar (mobile) or bottom bar (desktop) */}
          <div
            className="absolute inset-x-0 top-0 rounded-[24px] overflow-hidden bg-[#1b1b1e]"
            style={{ bottom: videoBottom }}
          >
            {customerId ? (
              <MemoizedParticipant
                participantId={customerId}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#303033] flex items-center justify-center">
                  {isAudioOnly
                    ? <MicrophoneIcon className="w-8 h-8 text-[#919093]" />
                    : <VideoCameraIcon className="w-8 h-8 text-[#919093]" />}
                </div>
                <p className="text-[#919093] text-sm">Waiting for patient to join…</p>
              </div>
            )}
          </div>

          {/* Agent self-view PiP */}
          <div
            className="absolute overflow-hidden border border-[#ff6f61] z-10 bg-[#303033]
              w-[130px] h-[170px] right-3 rounded-[16px]
              md:w-[275px] md:h-[150px] md:right-8 md:rounded-[24px]"
            style={{ bottom: videoBottom + 12 }}
          >
            <MemoizedParticipant participantId={localParticipant.id} isPip={true} />
          </div>
        </div>

        {/* Connection details drawer — full-screen on mobile, side panel on desktop */}
        {drawerOpen && (
          isMobile ? (
            <div className="fixed inset-0 z-50">{connectionPanel}</div>
          ) : (
            <div className="shrink-0 h-full" style={{ paddingBottom: bottomBarHeight }}>
              {connectionPanel}
            </div>
          )
        )}
      </div>

      {/* Step pill — above the bottom bar on mobile only */}
      {isMobile && (
        <div className="absolute left-4 right-4 z-20" style={{ bottom: bottomBarHeight + 8 }}>
          <DoctorStepBar
            completedSteps={completedSteps}
            onStepClick={() => setDrawerOpen(true)}
          />
        </div>
      )}

      {/* Floating control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <BottomBar
          bottomBarHeight={bottomBarHeight}
          completedSteps={completedSteps}
          customerId={customerId}
          onShowConnectionDetails={() => setDrawerOpen(true)}
        />
      </div>
    </div>
  );
}
