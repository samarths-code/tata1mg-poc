import React, { Fragment, useEffect, useState } from "react";
import { Popover, Transition } from "../../lib/headless";
import { useMeeting, useParticipant } from "@videosdk.live/react-sdk";
import Pill from "../buttons/Pill";

// Polled only while the panel is open — each call is a small signalling request.
const POLL_MS = 3000;

const SignalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="4" y2="16" />
    <line x1="9" y1="20" x2="9" y2="12" />
    <line x1="14" y1="20" x2="14" y2="8" />
    <line x1="19" y1="20" x2="19" y2="4" />
  </svg>
);

function formatBitrate(kbps) {
  if (kbps == null) return "—";
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(2)} Mbps` : `${Math.round(kbps)} kbps`;
}

function formatBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// Transport stats for one participant, as seen by the media server:
// send = what they upload, receive = what they download.
function ParticipantTransportStats({ participantId, label }) {
  const { getTransportStats, displayName } = useParticipant(participantId);
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const s = await getTransportStats();
        if (cancelled) return;
        setStats(s);
        setFailed(!s);
      } catch (e) {
        if (!cancelled) setFailed(true);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  const rows = [
    ["Upload", formatBitrate(stats?.send?.outgoingBitrate)],
    ["Download", formatBitrate(stats?.receive?.incomingBitrate)],
    ["Total sent", formatBytes(stats?.send?.totalSentBytes)],
    ["Total received", formatBytes(stats?.receive?.totalReceivedBytes)],
  ];

  return (
    <div className="rounded-lg border border-[#303033] p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white text-sm font-medium truncate">{label}</span>
        <span className="text-[#919093] text-xs truncate ml-2 max-w-[110px]">{displayName}</span>
      </div>
      {failed && !stats ? (
        <p className="text-[#919093] text-xs">Stats unavailable</p>
      ) : (
        rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-0.5">
            <span className="text-[#919093] text-xs">{k}</span>
            <span className="text-white text-xs tabular-nums">{stats ? v : "…"}</span>
          </div>
        ))
      )}
    </div>
  );
}

// Doctor-only: transport-level network stats for the patient and the doctor.
export default function NetworkStatsButton({ customerId }) {
  const { localParticipant } = useMeeting();

  return (
    <Pill>
      <Popover className="relative">
        <Popover.Button
          title="Network stats"
          aria-label="Network stats"
          className="flex items-center justify-center p-1 rounded"
        >
          <SignalIcon />
        </Popover.Button>
        <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
          {/* Panel content only mounts while open, so polling stops when closed. */}
          <Popover.Panel className="absolute left-1/2 bottom-full z-10 -translate-x-1/2 pb-3">
            <div className="bg-[#1b1b1e] border border-[#303033] rounded-lg p-3 shadow-lg w-[260px] space-y-2">
              <p className="text-xs text-[#919093] uppercase tracking-wide">Network (transport)</p>
              {customerId ? (
                <ParticipantTransportStats participantId={customerId} label="Patient" />
              ) : (
                <p className="text-[#919093] text-xs">Patient not connected</p>
              )}
              {localParticipant?.id && (
                <ParticipantTransportStats participantId={localParticipant.id} label="You" />
              )}
            </div>
          </Popover.Panel>
        </Transition>
      </Popover>
    </Pill>
  );
}
