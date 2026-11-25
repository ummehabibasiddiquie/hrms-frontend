import React, { useEffect, useState } from "react";
import { BookOpen, FileText, Maximize2 } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";

const SOP_CSS = `
.task-sop-html {
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  color: #1e293b;
  font-size: 15px;
  line-height: 1.65;
}
.task-sop-html > *:first-child { margin-top: 0; }
.task-sop-html h1 {
  font-size: 1.4rem;
  font-weight: 750;
  letter-spacing: -0.03em;
  color: #0f172a;
  margin: 0 0 0.65rem;
  line-height: 1.25;
}
.task-sop-html h1:first-child {
  background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  margin-bottom: 1rem;
}
.task-sop-html h2 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e3a8a;
  margin: 1.35rem 0 0.5rem;
  padding: 0.4rem 0.7rem;
  background: #f8fafc;
  border-left: 4px solid #2563eb;
  border-radius: 0 8px 8px 0;
  line-height: 1.35;
}
.task-sop-html h3 {
  font-size: 0.98rem;
  font-weight: 700;
  color: #334155;
  margin: 1rem 0 0.35rem;
}
.task-sop-html h4, .task-sop-html h5, .task-sop-html h6 {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  margin: 0.9rem 0 0.3rem;
}
.task-sop-html p { margin: 0 0 0.7rem; color: #334155; }
.task-sop-html p.sop-lead {
  font-size: 1.02rem;
  color: #475569;
  background: #f8fafc;
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
}
.task-sop-html ul {
  margin: 0 0 0.9rem;
  padding-left: 1.2rem;
  color: #334155;
}
.task-sop-html ul { list-style: disc; }
.task-sop-html ul ul { list-style: circle; margin: 0.2rem 0 0.3rem; }
.task-sop-html ol.sop-steps,
.task-sop-html ol {
  list-style: none;
  margin: 0.4rem 0 1rem;
  padding: 0;
  counter-reset: sop-step;
}
.task-sop-html ol > li {
  counter-increment: sop-step;
  position: relative;
  margin: 0 0 0.55rem;
  padding: 0.75rem 0.9rem 0.75rem 3.1rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.task-sop-html ol > li::before {
  content: counter(sop-step);
  position: absolute;
  left: 0.7rem;
  top: 0.7rem;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.75rem;
  text-align: center;
}
.task-sop-html li > p { margin: 0.1rem 0; }
.task-sop-html strong, .task-sop-html b { font-weight: 650; color: #0f172a; }
.task-sop-html a { color: #1d4ed8; text-underline-offset: 2px; }
.task-sop-html hr { border: 0; border-top: 1px dashed #cbd5e1; margin: 1.2rem 0; }
.task-sop-html blockquote,
.task-sop-html .sop-callout {
  margin: 0.7rem 0 1rem;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #334155;
}
.task-sop-html .sop-note, .task-sop-html .sop-check { background: #fffbeb; border-color: #fde68a; }
.task-sop-html .sop-tip { background: #ecfdf5; border-color: #a7f3d0; }
.task-sop-html .sop-warning, .task-sop-html .sop-important { background: #fff1f2; border-color: #fecdd3; }
.task-sop-html table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0.75rem 0 1rem;
  font-size: 0.9rem;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.task-sop-html th, .task-sop-html td {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.5rem 0.65rem;
  text-align: left;
  vertical-align: top;
}
.task-sop-html th { background: #eff6ff; font-weight: 650; color: #1e3a8a; }
.task-sop-html tr:last-child td { border-bottom: 0; }
.task-sop-html figure.sop-shot {
  margin: 0.7rem 0 1.1rem;
  padding: 0.45rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.task-sop-html .sop-shot-label {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  margin: 0.15rem 0.35rem 0.4rem;
}
.task-sop-html img, .task-sop-html .sop-shot img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0;
  border-radius: 8px;
  background: #fff;
}
.task-sop-html p.sop-caption {
  font-size: 0.82rem;
  color: #64748b;
  margin: 0.35rem 0.35rem 0.15rem;
}
`;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openSopFullView(sop, { draft = false } = {}) {
  const fileName = draft ? sop?.draft_file_name : sop?.original_file_name;
  const html = draft ? sop?.draft_html_body : sop?.html_body;
  const displayName = String(fileName || "")
    .replace(/\.docx$/i, "")
    .trim();
  const title = escapeHtml(displayName || (draft ? "Pending SOP (not approved)" : "Task SOP"));
  const label = draft ? "Pending SOP — not approved yet" : "Task SOP — approved";
  const wrapBg = draft ? "#fffbeb" : "#fff";
  const wrapBorder = draft ? "#f59e0b" : "#e2e8f0";
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { margin: 0; background: linear-gradient(180deg, ${draft ? "#fef3c7" : "#e0e7ff"} 0%, #f1f5f9 28%); color: #1e293b; }
    header { position: sticky; top: 0; background: rgba(255,255,255,.92); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; padding: 14px 28px; z-index: 1; }
    header p { margin: 0; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: ${draft ? "#b45309" : "#2563eb"}; font-weight: 700; }
    header h1 { margin: 4px 0 0; font-size: 20px; font-family: "Segoe UI", system-ui, sans-serif; font-weight: 700; color: #0f172a; }
    .wrap { max-width: 820px; margin: 24px auto; background: ${wrapBg}; padding: 32px 40px; border: 1px solid ${wrapBorder}; border-radius: 16px; box-shadow: 0 10px 30px rgba(15,23,42,.06); }
    ${SOP_CSS}
  </style>
</head>
<body>
  <header>
    <p>${label}</p>
    <h1>${title}</h1>
  </header>
  <article class="task-sop-html wrap">${html || ""}</article>
</body>
</html>`;
  const blob = new Blob([page], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (!tab) {
    URL.revokeObjectURL(url);
    toast.error("Allow pop-ups to open the SOP in a new tab");
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function SopNoticeModal({ notice, onAck }) {
  if (!notice?.show || !notice.items?.length) return null;
  const item = notice.items[0];
  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onAck}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-bold text-slate-800">
          {item.kind === "new" ? "New SOP" : "SOP updated"}
        </p>
        <p className="text-sm text-slate-700 mt-2">
          {item.kind === "new"
            ? `New SOP is added${item.date ? ` on ${item.date}` : ""}. Please read it carefully.`
            : `SOP is updated${item.date ? ` on ${item.date}` : ""}. Please read it carefully.`}
        </p>
        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onAck}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TaskSopViewer({ taskId, userId, className = "" }) {
  const [sop, setSop] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId || !userId) {
      setSop(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api
      .post("/task_sop/get", { logged_in_user_id: userId, task_id: taskId })
      .then((res) => {
        if (!cancelled) setSop(res.data?.data?.sop || null);
      })
      .catch(() => {
        if (!cancelled) setSop(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, userId]);

  return (
    <div className={`h-full min-h-0 flex flex-col bg-gradient-to-b from-indigo-50 to-slate-100 ${className}`}>
      <style>{SOP_CSS}</style>
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-indigo-100 bg-white/90">
        <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">How to do this task</p>
          {(sop?.original_file_name || sop?.draft_file_name) && (
            <p className="text-sm font-semibold text-slate-800 truncate">
              {String(sop.original_file_name || sop.draft_file_name).replace(/\.docx$/i, "")}
            </p>
          )}
        </div>
        {sop?.html_body && (
          <button
            type="button"
            onClick={() => openSopFullView(sop)}
            className="inline-flex items-center gap-1 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            title="Open full SOP in a new tab"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Full view
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading SOP…</p>}
        {!loading && !taskId && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-500">
            <FileText className="w-8 h-8 mb-2 text-slate-300" />
            <p className="text-sm">Select a task to read its SOP here.</p>
          </div>
        )}
        {!loading && taskId && !sop && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-500">
            <FileText className="w-8 h-8 mb-2 text-slate-300" />
            <p className="text-sm">No SOP for this task yet.</p>
          </div>
        )}
        {!loading && sop && sop.has_draft && (
          <div className="mx-auto max-w-[40rem] rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              {sop.has_approved ? "Pending SOP changes" : "Draft — waiting for approval"}
            </p>
            <p className="text-sm text-amber-900 mt-1">
              {sop.has_approved
                ? "There are changes in this SOP that are not approved yet. Follow the approved steps in the white section. For any query about the yellow (pending) part, contact your team leader."
                : "This SOP is not approved yet, so it is not live. Contact your team leader before you follow these steps."}
            </p>
            {sop.draft_change_note && (
              <p className="text-xs text-amber-800 mt-2">Note: {sop.draft_change_note}</p>
            )}
          </div>
        )}
        {!loading && sop && sop.has_approved && (
          <article
            className="task-sop-html mx-auto max-w-[40rem] bg-white shadow-md border border-slate-200 rounded-2xl px-6 py-6"
            dangerouslySetInnerHTML={{ __html: sop.html_body || "" }}
          />
        )}
        {!loading && sop && sop.has_draft && (
          <div className="mx-auto max-w-[40rem]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Not approved yet</p>
              {sop.draft_html_body && (
                <button
                  type="button"
                  onClick={() => openSopFullView(sop, { draft: true })}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Full pending view
                </button>
              )}
            </div>
            <article
              className="task-sop-html bg-amber-50 shadow-md border-2 border-dashed border-amber-400 rounded-2xl px-6 py-6"
              dangerouslySetInnerHTML={{ __html: sop.draft_html_body || "" }}
            />
          </div>
        )}
        {!loading && sop && !sop.has_approved && !sop.has_draft && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-500">
            <FileText className="w-8 h-8 mb-2 text-slate-300" />
            <p className="text-sm">No SOP for this task yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
