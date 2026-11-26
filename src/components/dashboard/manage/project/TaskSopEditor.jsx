import React, { useEffect, useRef, useState } from "react";
import { Check, Download, Eye, FileText, Trash2, Upload, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../../../services/api";
import { getFriendlyErrorMessage } from "../../../../utils/errorMessages";
import { openSopFullView } from "../../../common/TaskSopViewer";

/** Keep in sync with backend task_sop.MAX_SOP_FILE_MB */
const MAX_SOP_FILE_MB = 25;
const MAX_SOP_FILE_BYTES = MAX_SOP_FILE_MB * 1024 * 1024;
const SOP_FILE_TOO_LARGE_MSG =
  `SOP Word file is too large. Maximum allowed size is ${MAX_SOP_FILE_MB} MB. Compress or remove large screenshots and try again.`;

export default function TaskSopEditor({ taskId, userId }) {
  const [sop, setSop] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [file, setFile] = useState(null);
  const [changeNote, setChangeNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const load = async () => {
    if (!taskId || !userId) return;
    setLoading(true);
    try {
      const res = await api.post("/task_sop/get", {
        logged_in_user_id: userId,
        task_id: taskId,
      });
      const data = res.data?.data || {};
      setSop(data.sop || null);
      setCanManage(Boolean(data.can_manage));
      setFile(null);
      setChangeNote(data.sop?.draft_change_note || "");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Could not load task SOP"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, userId]);

  const handleFile = (event) => {
    const next = event.target.files?.[0];
    event.target.value = "";
    if (!next) return;
    if (!String(next.name || "").toLowerCase().endsWith(".docx")) {
      toast.error("Only a Word document (.docx) is allowed");
      return;
    }
    if (Number(next.size || 0) > MAX_SOP_FILE_BYTES) {
      toast.error(SOP_FILE_TOO_LARGE_MSG);
      return;
    }
    setFile(next);
  };

  const applySop = (next) => {
    setSop(next || null);
    setFile(null);
    setChangeNote(next?.draft_change_note || "");
  };

  const uploadDocxToCloudinary = async (docxFile) => {
    const signRes = await api.post("/task_sop/cloudinary_sign", {
      logged_in_user_id: userId,
      task_id: taskId,
    });
    const sign = signRes.data?.data || {};
    if (!sign.upload_url || !sign.signature) {
      throw new Error(signRes.data?.message || "Could not prepare Cloudinary upload");
    }
    const body = new FormData();
    body.append("file", docxFile);
    body.append("api_key", sign.api_key);
    body.append("timestamp", String(sign.timestamp));
    body.append("signature", sign.signature);
    body.append("folder", sign.folder);
    body.append("public_id", sign.public_id);
    body.append("overwrite", "1");
    const up = await fetch(sign.upload_url, { method: "POST", body });
    const upJson = await up.json().catch(() => ({}));
    if (!up.ok || !upJson.secure_url) {
      throw new Error(upJson.error?.message || "Cloudinary upload failed");
    }
    return {
      cloudinary_url: upJson.secure_url,
      file_name: sign.file_name || docxFile.name,
    };
  };

  const handleSaveDraft = async () => {
    if (!file && !sop?.has_draft) {
      toast.error("Upload a Word document (.docx) to save as draft");
      return;
    }
    if (file && Number(file.size || 0) > MAX_SOP_FILE_BYTES) {
      toast.error(SOP_FILE_TOO_LARGE_MSG);
      return;
    }
    setSaving(true);
    try {
      let payload = {
        logged_in_user_id: userId,
        task_id: taskId,
        change_note: changeNote,
      };
      if (file) {
        // Direct to Cloudinary folder hrms/task_sop (same pattern as other HRMS files).
        // Avoids Vercel 413 when the Word file is larger than ~4.5 MB.
        const uploaded = await uploadDocxToCloudinary(file);
        payload = { ...payload, ...uploaded };
      }
      const res = await api.post("/task_sop/save", payload);
      applySop(res.data?.data?.sop);
      const emailed = Number(res.data?.data?.email_count || 0);
      toast.success(
        emailed > 0
          ? `Saved as draft. ${emailed} checker${emailed === 1 ? "" : "s"} emailed to approve.`
          : "Saved as draft. Not live until another checker approves."
      );
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      const apiMsg = err?.response?.data?.message || err?.message;
      const raw = String(apiMsg || err?.response?.statusText || "").toLowerCase();
      if (
        status === 413 ||
        raw.includes("too large") ||
        raw.includes("content too large") ||
        raw.includes("entity too large")
      ) {
        toast.error(
          typeof apiMsg === "string" && apiMsg.trim() && !/^<!doctype|^<html/i.test(apiMsg)
            ? apiMsg
            : SOP_FILE_TOO_LARGE_MSG
        );
      } else {
        toast.error(getFriendlyErrorMessage(err) || String(apiMsg || "Could not save draft"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!sop?.has_draft) return;
    setSaving(true);
    try {
      const res = await api.post("/task_sop/approve", {
        logged_in_user_id: userId,
        task_id: taskId,
      });
      applySop(res.data?.data?.sop);
      const emailed = Number(res.data?.data?.email_count || 0);
      toast.success(
        emailed > 0
          ? `SOP approved. ${emailed} people emailed.`
          : "SOP approved. Agents now see this version."
      );
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Could not approve SOP"));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!sop?.has_draft) return;
    setSaving(true);
    try {
      const res = await api.post("/task_sop/discard_draft", {
        logged_in_user_id: userId,
        task_id: taskId,
      });
      applySop(res.data?.data?.sop);
      toast.success("Draft discarded");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Could not discard draft"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sop) return;
    setSaving(true);
    try {
      await api.post("/task_sop/delete", {
        logged_in_user_id: userId,
        task_id: taskId,
      });
      applySop(null);
      toast.success("Task SOP removed");
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Could not remove task SOP"));
    } finally {
      setSaving(false);
    }
  };

  if (!taskId) return null;

  return (
    <div className="md:col-span-2 mt-1 border border-blue-100 rounded-lg p-3 bg-white">
      <h4 className="text-sm font-bold text-slate-700 mb-2 text-left">Task SOP (Word only)</h4>
      <p className="text-xs text-slate-500 mb-2 text-left">
        Upload saves a <strong>draft</strong> to Cloudinary (<code>hrms/task_sop</code>) as
        <code>Task_ProjCode_SOP_date.docx</code>. Another checker must approve it (uploader cannot).
        Word file max size: <strong>{MAX_SOP_FILE_MB} MB</strong>.
      </p>
      <div className="text-xs text-slate-600 mb-3 text-left rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
        <p className="font-semibold text-slate-700">Write the Word file like this:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>Title</strong> style for the SOP name</li>
          <li><strong>Heading 1</strong> for sections (Before you start, Steps, Checks)</li>
          <li><strong>Heading 2</strong> for each step name</li>
          <li>Numbered list for the actions inside a step</li>
          <li>Paste the screenshot <em>under</em> the step it belongs to</li>
          <li>Start a line with <strong>Note:</strong>, <strong>Tip:</strong> or <strong>Warning:</strong> for callouts</li>
        </ul>
        <a
          href="/templates/Task_SOP_Template.docx"
          download
          className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline mt-1"
        >
          Download SOP template
        </a>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading SOP…</p>
      ) : (
        <div className="space-y-3">
          {sop?.has_draft && !sop?.has_approved && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2 text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Waiting for approval</p>
              <p className="text-xs text-amber-900 mt-1">
                This first SOP is a draft. Agents can see it in yellow, but it is not live until someone
                with Assistant Manager, Project Manager, Admin, Super Admin, or QA clicks Approve SOP.
              </p>
            </div>
          )}
          {sop?.has_approved && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs text-slate-700 truncate min-w-0 flex-1">
                Live (approved): {sop.original_file_name || "Current SOP"}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!sop.html_body) {
                    toast.error("No HTML preview for this SOP yet. Download the Word file instead.");
                    return;
                  }
                  openSopFullView(sop);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-white"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </button>
              {sop.original_file_url ? (
                <a
                  href={sop.original_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={sop.original_file_name || "task-sop.docx"}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              ) : null}
            </div>
          )}

          {sop?.has_draft && (
            <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-3 py-2 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Draft — not live</p>
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-xs text-amber-950 truncate min-w-0 flex-1">
                  {sop.draft_file_name || "Pending SOP"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!sop.draft_html_body) {
                      toast.error("No HTML preview for this draft yet.");
                      return;
                    }
                    openSopFullView(sop, { draft: true });
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-md"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View draft
                </button>
                {sop.draft_file_url ? (
                  <a
                    href={sop.draft_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={sop.draft_file_name || "task-sop-draft.docx"}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                ) : null}
              </div>
              {canManage && (
                <div className="flex flex-wrap justify-end gap-2 items-center">
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-amber-900 border border-amber-300 rounded-lg bg-white hover:bg-amber-100"
                  >
                    Discard draft
                  </button>
                  {sop.can_approve ? (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={saving}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve SOP
                    </button>
                  ) : (
                    <p className="text-xs text-amber-800">
                      You added this draft. Another checker must approve it.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">Word document (.docx)</label>
            {file && (
              <div className="flex items-center gap-2 text-xs text-blue-700 mb-1">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} disabled={saving}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {canManage && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFile}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
                >
                  <Upload className="w-4 h-4" />
                  {sop?.has_draft || sop?.has_approved ? "Upload new draft .docx" : "Upload .docx"}
                </button>
                <label className="block text-xs font-semibold text-slate-500 mt-2 mb-1 text-left">
                  What changed (optional)
                </label>
                <textarea
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  placeholder="Agents and checkers will see this with the yellow pending section."
                />
              </>
            )}
          </div>
          {canManage && (
            <div className="flex justify-end gap-2">
              {sop?.has_approved && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete live SOP
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {saving ? "Saving…" : "Save as draft"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
