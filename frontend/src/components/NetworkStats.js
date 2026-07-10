import usePrecallTest from "../lib/usePrecallTest";

export default function NetworkStats({ token }) {
  // usePrecallTest owns the state machine and auto-runs once `token` is ready.
  // VideoSDK 0.12.5 reports a 0–10 quality score (not Mbps); see lib/precallTest.js.
  const { status, result, run } = usePrecallTest({ token, samplingDuration: 12000 });

  const q = result ?? { label: "Unknown", color: "text-white/70" };

  const pill = "flex items-center gap-1.5 bg-[rgba(0,0,0,0.1)] backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-white text-xs select-none";

  return (
    <div className={pill}>
      {(status === "idle" || status === "loading") && (
        <>
          <RefreshSvg className="w-3.5 h-3.5 text-white/60 animate-spin" />
          <span className="text-white/70 font-normal">Checking…</span>
        </>
      )}

      {status === "success" && (
        <>
          <button onClick={run} className="flex items-center gap-1.5 focus:outline-none">
            <RefreshSvg className="w-3.5 h-3.5 text-white/70" />
            <span className={`font-medium ${q.color}`}>{q.label}</span>
          </button>
          {result?.latencyMs != null && (
            <>
              <Divider />
              <span className="font-normal text-white/80">{result.latencyMs} ms</span>
            </>
          )}
        </>
      )}

      {status === "no-wifi" && (
        <>
          <span className="text-red-400">No network</span>
          <button onClick={run} className="focus:outline-none ml-0.5">
            <RefreshSvg className="w-3.5 h-3.5 text-white/70" />
          </button>
        </>
      )}

      {status === "timeout" && (
        <button onClick={run} className="flex items-center gap-1.5 focus:outline-none text-white/60 hover:text-white/90 transition-colors">
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

