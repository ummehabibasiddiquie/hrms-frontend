import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, FileText, Link2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";

const emptyTopic = { title: "", description: "" };
const emptyItem = { title: "", item_type: "link", link_url: "", file: null };

function openTarget(item) {
  return item.item_type === "file" ? item.file_url : item.link_url;
}

const FILE_TYPES = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

function downloadName(item) {
  const extension = fileExtension(item.file_name);
  const title = String(item.title || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return item.file_name || `document${extension}`;
  if (extension && title.toLowerCase().endsWith(extension)) return title;
  return `${title}${extension}`;
}

async function downloadOriginalFile(item) {
  const fileName = downloadName(item);
  const response = await fetch(item.file_url);
  if (!response.ok) throw new Error("download failed");
  const bytes = await response.arrayBuffer();
  const type = FILE_TYPES[fileExtension(fileName)] || "application/octet-stream";
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SopLibrary() {
  const { user } = useAuth();
  const userId = user?.user_id;
  const [topics, setTopics] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [topicForm, setTopicForm] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const applyTopics = useCallback((next, preferredId) => {
    setTopics(next || []);
    setActiveTopicId((current) => {
      if (preferredId && next.some((topic) => topic.sop_topic_id === preferredId)) {
        return preferredId;
      }
      if (next.some((topic) => topic.sop_topic_id === current)) return current;
      return next[0]?.sop_topic_id ?? null;
    });
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await api.post("/sop/list", { logged_in_user_id: userId });
      const data = res?.data?.data || {};
      setCanManage(Boolean(data.can_manage));
      applyTopics(data.topics || []);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Could not load SOPs"));
    } finally {
      setLoading(false);
    }
  }, [userId, applyTopics]);

  useEffect(() => {
    load();
  }, [load]);

  const activeTopic = topics.find((topic) => topic.sop_topic_id === activeTopicId) || null;

  const saveTopic = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await api.post("/sop/topic/save", {
        logged_in_user_id: userId,
        sop_topic_id: topicForm.sop_topic_id || undefined,
        title: topicForm.title,
        description: topicForm.description,
      });
      applyTopics(res?.data?.data?.topics || []);
      setTopicForm(null);
      toast.success("Topic saved");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Could not save topic"));
    } finally {
      setSaving(false);
    }
  };

  const removeTopic = async (topic) => {
    if (!window.confirm(`Remove the topic “${topic.title}” and everything in it?`)) return;
    try {
      const res = await api.post("/sop/topic/delete", {
        logged_in_user_id: userId,
        sop_topic_id: topic.sop_topic_id,
      });
      applyTopics(res?.data?.data?.topics || []);
      toast.success("Topic removed");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Could not remove topic"));
    }
  };

  const saveItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("logged_in_user_id", String(userId));
      form.append("sop_topic_id", String(activeTopic.sop_topic_id));
      form.append("title", itemForm.title);
      form.append("item_type", itemForm.item_type);
      if (itemForm.item_type === "link") {
        form.append("link_url", itemForm.link_url);
      } else if (itemForm.file) {
        form.append("file", itemForm.file);
      }
      const res = await api.post("/sop/item/save", form);
      applyTopics(res?.data?.data?.topics || [], activeTopic.sop_topic_id);
      setItemForm(null);
      toast.success("SOP added");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Could not save SOP"));
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Remove “${item.title}”?`)) return;
    try {
      const res = await api.post("/sop/item/delete", {
        logged_in_user_id: userId,
        sop_item_id: item.sop_item_id,
      });
      applyTopics(res?.data?.data?.topics || [], activeTopicId);
      toast.success("SOP removed");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Could not remove SOP"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Organization SOPs
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Topics for policies and procedures. Each item can be a link or a document.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setTopicForm({ ...emptyTopic })}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New topic
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading SOPs…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-2">
            {topics.length === 0 && (
              <p className="px-2 py-6 text-sm text-slate-500">No topics yet.</p>
            )}
            {topics.map((topic) => (
              <button
                key={topic.sop_topic_id}
                type="button"
                onClick={() => setActiveTopicId(topic.sop_topic_id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  topic.sop_topic_id === activeTopicId
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="block truncate">{topic.title}</span>
                <span className="text-xs text-slate-400">{topic.items?.length || 0} items</span>
              </button>
            ))}
          </aside>

          <section className="rounded-xl border border-slate-200 bg-white p-4 min-h-[280px]">
            {!activeTopic && (
              <p className="text-sm text-slate-500">
                {canManage ? "Create a topic, then add links or documents under it." : "Nothing has been published yet."}
              </p>
            )}
            {activeTopic && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{activeTopic.title}</h3>
                    {activeTopic.description && (
                      <p className="mt-1 text-sm text-slate-500">{activeTopic.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setItemForm({ ...emptyItem })}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          <Plus className="w-4 h-4" />
                          Add SOP
                        </button>
                        <button
                          type="button"
                          onClick={() => setTopicForm({
                            sop_topic_id: activeTopic.sop_topic_id,
                            title: activeTopic.title,
                            description: activeTopic.description || "",
                          })}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Edit topic
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTopic(activeTopic)}
                          className="rounded-lg border border-red-200 px-2 py-1.5 text-red-600 hover:bg-red-50"
                          aria-label="Remove topic"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-slate-100">
                  {(activeTopic.items || []).length === 0 && (
                    <li className="py-6 text-sm text-slate-500">No links or documents in this topic yet.</li>
                  )}
                  {(activeTopic.items || []).map((item) => {
                    const href = openTarget(item);
                    return (
                      <li key={item.sop_item_id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          {item.item_type === "link" && href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate font-medium text-blue-700 hover:underline"
                            >
                              {item.title}
                            </a>
                          ) : (
                            <p className="truncate font-medium text-slate-800">{item.title}</p>
                          )}
                          {item.item_type === "link" && href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-xs text-blue-600 hover:underline"
                            >
                              Open link
                            </a>
                          ) : (
                            <p className="truncate text-xs text-slate-400">
                              {item.file_name || "Document"}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {href && item.item_type === "file" && (
                            <button
                              type="button"
                              onClick={() => {
                                downloadOriginalFile(item).catch(() => {
                                  toast.error("Could not download this file");
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="w-4 h-4" />
                              Open
                            </button>
                          )}
                          {href && item.item_type !== "file" && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Link2 className="w-4 h-4" />
                              Open
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => removeItem(item)}
                              className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                              aria-label="Remove SOP"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>
      )}

      {topicForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveTopic} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">
              {topicForm.sop_topic_id ? "Edit topic" : "New topic"}
            </h3>
            <label className="mt-4 block text-sm text-slate-600">
              Title
              <input
                required
                value={topicForm.title}
                onChange={(event) => setTopicForm({ ...topicForm, title: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Attendance, Leave, Quality…"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-600">
              Description
              <textarea
                value={topicForm.description}
                onChange={(event) => setTopicForm({ ...topicForm, description: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTopicForm(null)} className="rounded-lg px-3 py-2 text-sm text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60">
                Save topic
              </button>
            </div>
          </form>
        </div>
      )}

      {itemForm && activeTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveItem} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Add to {activeTopic.title}</h3>
            <label className="mt-4 block text-sm text-slate-600">
              Title
              <input
                required
                value={itemForm.title}
                onChange={(event) => setItemForm({ ...itemForm, title: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Leave policy"
              />
            </label>
            <div className="mt-3 flex gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={itemForm.item_type === "link"}
                  onChange={() => setItemForm({ ...itemForm, item_type: "link", file: null })}
                />
                Link
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={itemForm.item_type === "file"}
                  onChange={() => setItemForm({ ...itemForm, item_type: "file", link_url: "" })}
                />
                Document
              </label>
            </div>
            {itemForm.item_type === "link" ? (
              <label className="mt-3 block text-sm text-slate-600">
                URL
                <input
                  required
                  type="url"
                  value={itemForm.link_url}
                  onChange={(event) => setItemForm({ ...itemForm, link_url: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="https://"
                />
              </label>
            ) : (
              <label className="mt-3 block text-sm text-slate-600">
                File (PDF, PPT, DOC, or other document, up to 25 MB)
                <span className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-slate-500">
                  <Upload className="w-4 h-4" />
                  <input
                    required
                    type="file"
                    onChange={(event) => setItemForm({ ...itemForm, file: event.target.files?.[0] || null })}
                    className="text-sm"
                  />
                </span>
              </label>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setItemForm(null)} className="rounded-lg px-3 py-2 text-sm text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60">
                Save SOP
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
