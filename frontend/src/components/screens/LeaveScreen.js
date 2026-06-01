import { CheckCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import Tata1mgLogo from "../Tata1mgLogo";

export function LeaveScreen({ participantName }) {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-6">
        <Tata1mgLogo dark />
      </div>

      {/* Centered main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-5">
        <div className="flex flex-col items-center gap-2">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5" style={{ color: "#22C55E" }} />
            <span
              className="text-sm font-medium"
              style={{ color: "#5E5E61" }}
            >
              Consultation Completed
            </span>
          </div>

          {/* Heading */}
          <h1
            className="text-2xl font-medium text-black text-center"
            style={{ lineHeight: "32px" }}
          >
            Thank You{participantName ? `, ${participantName}` : ""}!
          </h1>

          {/* Subtitle */}
          <div
            className="text-sm font-medium text-center"
            style={{ color: "#5E5E61", lineHeight: "20px" }}
          >
            <p className="mb-0">You have completed the consultation successfully.</p>
            <p>Thank you for your time and care.</p>
          </div>
        </div>
      </div>

      {/* Footer — security notice */}
      <div className="flex items-center justify-center gap-2 p-4 pb-8">
        <ShieldCheckIcon
          className="w-4 h-4 shrink-0"
          style={{ color: "#5E5E61" }}
        />
        <p
          className="text-sm font-medium text-center"
          style={{ color: "#5E5E61" }}
        >
          Your meeting is secure and encrypted. No one can join unless they are invited.
        </p>
      </div>
    </div>
  );
}
