import { getNetworkStats } from "@videosdk.live/react-sdk";
import { useEffect, useState } from "react";

// Quality derived from the slower of the two directions
function quality(dl, ul) {
  const min = Math.min(dl ?? 0, ul ?? 0);
  if (min >= 15) return { label: "Good", color: "text-green-400" };
  if (min >= 5)  return { label: "Fair", color: "text-yellow-300" };
  return           { label: "Poor",  color: "text-red-400" };
}

export default function NetworkStats() {
  // Keep the original state machine — it's been proven to work
  const [error, setError] = useState("no-error-loading");
  const [downloadSpeed, setDownloadSpeed] = useState(null);
  const [uploadSpeed, setUploadSpeed] = useState(null);

  useEffect(() => { getNetworkStatistics(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getNetworkStatistics = async () => {
    setError("no-error-loading");
    try {
      const networkStats = await getNetworkStats({ timeoutDuration: 45000 });
      if (networkStats) setError("no-error");
      setDownloadSpeed(networkStats?.downloadSpeed ?? networkStats?.["downloadSpeed"]);
      setUploadSpeed(networkStats?.uploadSpeed ?? networkStats?.["uploadSpeed"]);
    } catch (ex) {
      console.log("NetworkStats error:", ex);
      const msg = String(ex?.message ?? ex);
      if (msg.includes("no Network") || msg.includes("no network")) setError("no-wifi");
      else setError("timeout");
    }
  };

  const q = quality(downloadSpeed, uploadSpeed);

  const pill = "flex items-center gap-1.5 bg-[rgba(0,0,0,0.1)] backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-white text-xs select-none";

  return (
    <div className={pill}>
      {error === "no-error-loading" && (
        <>
          <RefreshSvg className="w-3.5 h-3.5 text-white/60 animate-spin" />
          <span className="text-white/70 font-normal">Checking…</span>
        </>
      )}

      {error === "no-error" && (
        <>
          <button onClick={getNetworkStatistics} className="flex items-center gap-1.5 focus:outline-none">
            <RefreshSvg className="w-3.5 h-3.5 text-white/70" />
            <span className={`font-medium ${q.color}`}>{q.label}</span>
          </button>
          <Divider />
          <ArrowUp className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span className="font-normal">{uploadSpeed} Mbps</span>
          <Divider />
          <ArrowDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="font-normal">{downloadSpeed} Mbps</span>
        </>
      )}

      {error === "no-wifi" && (
        <>
          <span className="text-red-400">No network</span>
          <button onClick={getNetworkStatistics} className="focus:outline-none ml-0.5">
            <RefreshSvg className="w-3.5 h-3.5 text-white/70" />
          </button>
        </>
      )}

      {error === "timeout" && (
        <button onClick={getNetworkStatistics} className="flex items-center gap-1.5 focus:outline-none text-white/60 hover:text-white/90 transition-colors">
          <RefreshSvg className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-white/25 shrink-0" />;
}

function RefreshSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function ArrowUp({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
    </svg>
  );
}
