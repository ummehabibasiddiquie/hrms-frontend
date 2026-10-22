import React, { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import api from "../../services/api";

/** View-only list of a project's shared-drive SOP links. Renders nothing when there are none. */
const ProjectSopLinks = ({ projectId, className = "" }) => {
  const [loaded, setLoaded] = useState({ projectId: null, links: [] });

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    api
      .post("/project/sop_links", { project_id: projectId })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        setLoaded({ projectId, links: Array.isArray(data?.sop_links) ? data.sop_links : [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ projectId, links: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const links = projectId && String(loaded.projectId) === String(projectId) ? loaded.links : [];
  if (!links.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
        <FileText className="w-3.5 h-3.5 text-blue-600" />
        Project SOP:
      </span>
      {links.map((link, index) => (
        <a
          key={`${link.url}-${index}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={link.url}
          className="inline-flex items-center gap-1 max-w-[220px] px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100"
        >
          <span className="truncate">{link.title || "Open SOP"}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      ))}
    </div>
  );
};

export default ProjectSopLinks;
