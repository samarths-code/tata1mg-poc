import { MicrophoneIcon, VideoCameraIcon } from "@heroicons/react/24/outline";
import { useMeetingAppContext } from "../context/MeetingAppContext";
import { MemoizedParticipant } from "./ParticipantView";

// Doctor and patient as two equal, modest tiles (like the prebuilt grid)
// instead of one full-bleed video: 360p / 180p streams stay sharp when they
// aren't stretched across the whole screen. Stacked top / bottom; on desktop
// each tile takes half the stage height, capped at 533x300 so it stays small.
//
// `tiles` is an ordered list of participant ids; `null` renders a waiting card
// in that slot (e.g. before the other side joins).
const TILE =
  "relative shrink-0 overflow-hidden rounded-[20px] bg-[#2a2a2d] " +
  "border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] " +
  "w-full max-w-[420px] aspect-[4/3] " +
  "md:h-[calc(50%-10px)] md:w-auto md:max-w-full md:max-h-[300px] md:aspect-video";

export default function SideBySideLayout({ tiles, waitingText, statusMessage }) {
  const isAudioOnly = useMeetingAppContext((s) => s.isAudioOnly);

  return (
    // Stage card: gives the small tiles a framed area instead of floating in empty space.
    <div className="relative flex-1 min-w-0 h-full p-0 md:p-3">
    <div className="relative h-full w-full flex flex-col items-center justify-center gap-3 md:gap-5 p-3 md:p-6 overflow-hidden md:rounded-[24px] md:bg-[#232326] md:border md:border-white/[0.04]">
      {tiles.map((id, i) =>
        id ? (
          <div key={id} className={TILE}>
            <MemoizedParticipant participantId={id} />
          </div>
        ) : (
          <div key={`waiting-${i}`} className={`${TILE} flex flex-col items-center justify-center gap-3 px-4`}>
            <div className="w-12 h-12 rounded-full bg-[#1b1b1e] flex items-center justify-center">
              {isAudioOnly
                ? <MicrophoneIcon className="w-6 h-6 text-[#919093]" />
                : <VideoCameraIcon className="w-6 h-6 text-[#919093]" />}
            </div>
            <p className="text-[#919093] text-sm text-center">{waitingText}</p>
          </div>
        )
      )}

      {/* Reconnecting overlay */}
      {statusMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 pointer-events-none">
          <p className="text-white text-xl md:text-2xl font-medium drop-shadow-lg select-none">
            {statusMessage}
          </p>
        </div>
      )}
    </div>
    </div>
  );
}
