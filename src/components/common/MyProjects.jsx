import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Search,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import { canOpenInBrowser, openDocumentInBrowser } from "../../utils/openDocument";

const fileNameFromUrl = (url, fallback) => {
  try {
    const last = decodeURIComponent(String(url).split("?")[0].split("/").pop() || "");
    return last || fallback;
  } catch {
    return fallback;
  }
};

/** File name that opens in the browser (PDF / Office viewer), plus a separate download icon. */
const FileActions = ({ url, name, label, icon }) => {
  const viewable = canOpenInBrowser(url, name);
  const fileIcon = icon || <FileText className="w-4 h-4 shrink-0" />;
  return (
    <span className="inline-flex items-center gap-2 max-w-full">
      {viewable ? (
        <button
          type="button"
          onClick={() => openDocumentInBrowser(url, name).catch(() => toast.error("Could not open this file"))}
          className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline break-all text-left"
          title={`Open ${name}`}
        >
          {fileIcon}
          {label || name}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 break-all">
          {fileIcon}
          {label || name}
        </span>
      )}
      <a
        href={url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-500 hover:text-slate-800 shrink-0"
        title={`Download ${name}`}
      >
        <Download className="w-4 h-4" />
      </a>
    </span>
  );
};

const InfoItem = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-sm font-medium text-slate-800 break-words">{value || "-"}</p>
  </div>
);

/** View-only list of the caller's projects: details, SOP links, project files and tasks with sample files. */
const MyProjects = () => {
  const { user } = useAuth();
  const roleText = String(user?.role_name || user?.role || "").toLowerCase();
  // Agents see only project files and each task's own target; QC details are for QA / Team Leader
  const isAgent = Number(user?.role_id) === 6 || roleText === "agent";
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!user?.user_id) return undefined;
    let cancelled = false;
    api
      .post("/project/my_projects", { logged_in_user_id: user.user_id })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setProjects(list);
        if (list.length === 1) setExpandedId(list[0].project_id);
      })
      .catch((err) => {
        if (!cancelled) setError(getFriendlyErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        (p.project_name || "").toLowerCase().includes(q) ||
        (p.project_code || "").toLowerCase().includes(q) ||
        (p.tasks || []).some((t) => (t.task_name || "").toLowerCase().includes(q))
    );
  }, [projects, search]);

  return (
    <div className="max-w-7xl mx-auto mt-2 space-y-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-5 py-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Projects</h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
            {projects.length}
          </span>
        </div>
        <span className="text-xs text-slate-500">View only</span>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project or task"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Loading projects...
        </div>
      )}
      {!loading && error && (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-6 text-center text-sm text-red-700">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          {projects.length ? "No project matches this search." : "No projects are assigned to you."}
        </div>
      )}

      {!loading &&
        !error &&
        filtered.map((project) => {
          const open = expandedId === project.project_id;
          const tasks = project.tasks || [];
          const files = project.project_files || [];
          const sopLinks = project.sop_links || [];
          return (
            <div
              key={project.project_id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : project.project_id)}
                className="w-full flex flex-wrap items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                  {(project.project_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 truncate">{project.project_name}</p>
                  <p className="text-xs text-slate-500">
                    {[project.project_code, project.category].filter(Boolean).join(" · ") || "Project"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">{tasks.length} tasks</span>
                  <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">{files.length} files</span>
                  <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{sopLinks.length} SOPs</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="border-t border-slate-200 px-5 py-4 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <InfoItem label="Project Manager" value={(project.project_manager || []).join(", ")} />
                    <InfoItem label="Assistant Manager(s)" value={(project.assistant_managers || []).join(", ")} />
                    <InfoItem label="Quality Analyst(s)" value={(project.qa || []).join(", ")} />
                    <InfoItem label="Category" value={project.category} />
                  </div>
                  {project.project_description && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Description</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{project.project_description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                        <FileText className="w-4 h-4 text-emerald-600" /> SOP links
                      </p>
                      {sopLinks.length === 0 ? (
                        <p className="text-sm text-slate-400">No SOP links added.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {sopLinks.map((link, i) => (
                            <li key={`${link.url}-${i}`}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline break-all"
                              >
                                {link.title || link.url}
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                        <Download className="w-4 h-4 text-purple-600" /> Project files
                      </p>
                      {files.length === 0 ? (
                        <p className="text-sm text-slate-400">No files uploaded.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {files.map((url, i) => (
                            <li key={`${url}-${i}`}>
                              <FileActions url={url} name={fileNameFromUrl(url, `File ${i + 1}`)} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-2">Tasks</p>
                    {tasks.length === 0 ? (
                      <p className="text-sm text-slate-400">No tasks are assigned to you in this project.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Task</th>
                              {!isAgent && <th className="px-3 py-2 text-left font-semibold">Description</th>}
                              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Target / hr</th>
                              {!isAgent && (
                                <>
                                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">QC target</th>
                                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">QC %</th>
                                  <th className="px-3 py-2 text-left font-semibold">Important columns</th>
                                </>
                              )}
                              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Sample file</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {tasks.map((task) => (
                              <tr key={task.task_id} className="align-top">
                                <td className="px-3 py-2 font-semibold text-slate-800">{task.task_name}</td>
                                {!isAgent && (
                                  <td className="px-3 py-2 text-slate-600 whitespace-pre-line">{task.task_description || "-"}</td>
                                )}
                                <td className="px-3 py-2">{task.task_target ?? "-"}</td>
                                {!isAgent && (
                                <>
                                <td className="px-3 py-2 text-slate-700">{task.qc_target || "-"}</td>
                                <td className="px-3 py-2">{task.qc_percentage != null && task.qc_percentage !== "" ? `${task.qc_percentage}%` : "-"}</td>
                                <td className="px-3 py-2">
                                  {(task.important_columns || []).length ? (
                                    <div className="flex flex-wrap gap-1">
                                      {task.important_columns.map((col, i) => (
                                        <span key={`${col}-${i}`} className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                                          {typeof col === "string" ? col : col?.name || col?.label || JSON.stringify(col)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                </>
                                )}
                                <td className="px-3 py-2">
                                  {task.sample_file ? (
                                    <FileActions
                                      url={task.sample_file}
                                      name={fileNameFromUrl(task.sample_file, "Sample file")}
                                      label="Sample file"
                                      icon={<FileSpreadsheet className="w-4 h-4 shrink-0 text-green-700" />}
                                    />
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};

export default MyProjects;
