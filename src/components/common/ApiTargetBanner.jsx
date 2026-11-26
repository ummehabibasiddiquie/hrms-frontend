import React, { useEffect, useMemo, useState } from "react";
import { Server, X } from "lucide-react";
import config from "../../config/environment";

const HIDE_KEY = "tfs_hide_api_target_banner";

function shouldShowTargets() {
  // Set VITE_SHOW_API_TARGETS=false on Vercel when you remove this for testers.
  if (import.meta.env.VITE_SHOW_API_TARGETS === "false") return false;
  // Temporary: always show so we can verify HRMS/QC URLs on the deployed test site.
  return true;
}

const ApiTargetBanner = () => {
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const targets = useMemo(() => {
    const hrms = config.apiBaseUrl || "(same origin / empty)";
    const qc = config.apiNodeBaseUrl || "(missing)";
    return { hrms, qc, appEnv: config.appEnv || "unknown" };
  }, []);

  useEffect(() => {
    if (!shouldShowTargets()) return;
    console.info(
      `[HRMS API targets] env=${targets.appEnv} | HRMS(Flask)=${targets.hrms} | QC(Node)=${targets.qc}`
    );
  }, [targets]);

  if (!shouldShowTargets() || hidden) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div
      className="sticky top-0 z-[99] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-violet-300 bg-violet-100 px-3 py-1.5 text-[11px] text-violet-950"
      role="status"
    >
      <Server className="h-3.5 w-3.5 shrink-0 text-violet-700" />
      <span className="font-bold uppercase tracking-wide">API targets ({targets.appEnv})</span>
      <span className="font-mono break-all">
        <span className="font-semibold">HRMS:</span> {targets.hrms}
      </span>
      <span className="font-mono break-all">
        <span className="font-semibold">QC:</span> {targets.qc}
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-violet-800 hover:bg-violet-200"
        title="Hide for this tab"
      >
        <X className="h-3.5 w-3.5" />
        Hide
      </button>
    </div>
  );
};

export default ApiTargetBanner;
