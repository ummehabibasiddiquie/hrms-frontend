import React from "react";
import { Lock } from "lucide-react";
import { getRosterLockMessage } from "../../utils/rosterUtils";

const RosterLockedBanner = ({ roster, message, title = "Roster locked", className = "" }) => {
  const text = message || getRosterLockMessage(roster);
  if (!text) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 ${className}`}
      role="status"
    >
      <Lock className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
      <div>
        <p className="font-semibold text-red-900">{title}</p>
        <p className="mt-0.5 text-red-800/90">{text}</p>
      </div>
    </div>
  );
};

export default RosterLockedBanner;
