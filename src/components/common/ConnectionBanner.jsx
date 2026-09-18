import React, { useEffect, useState } from "react";
import { WifiOff, Timer } from "lucide-react";
import {
  getConnectionState,
  hideConnectionIssue,
  showConnectionIssue,
  subscribeConnection,
} from "../../utils/connectionStatus";

const ConnectionBanner = () => {
  const [state, setState] = useState(getConnectionState);

  useEffect(() => subscribeConnection(setState), []);

  useEffect(() => {
    const onOffline = () => {
      showConnectionIssue("No internet. Check your connection.", "offline");
    };
    const onOnline = () => hideConnectionIssue();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      onOffline();
    }
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!state.visible) return null;

  const isTimeout = state.kind === "timeout";

  return (
    <div
      className={`sticky top-0 z-[100] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-center ${
        isTimeout
          ? "bg-orange-500 text-white"
          : "bg-amber-400 text-amber-950"
      }`}
      role="status"
      aria-live="assertive"
    >
      {isTimeout ? (
        <Timer className="h-4 w-4 shrink-0" />
      ) : (
        <WifiOff className="h-4 w-4 shrink-0" />
      )}
      <span>{state.message}</span>
    </div>
  );
};

export default ConnectionBanner;
