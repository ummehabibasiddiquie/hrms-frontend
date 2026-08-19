// Button-controlled Project Instruction Preview (must be above AgentProjectList)
function ProjectInstructionPreview({ projectId, loading, error, html, instructionFile }) {
  const [show, setShow] = useState(false);
  // Helper to open preview in new tab
  const handleOpenInNewTab = () => {
    if (!html) return;
    // Use the same processing as DocxPreview
    function fixTableHeadings(html) {
      return html.replace(/(<table[\s\S]*?<\/table>)(\s*<(h[1-6])[^>]*>.*?<\/\3>)/gi, '$2$1');
    }
    function addImageStyling(html) {
      return html.replace(/<img /g, '<img class="project-docx-img" ');
    }
    let processedHtml = addImageStyling(fixTableHeadings(html));
    const style = `
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f6ff; margin: 0; padding: 2em; }
        .project-docx-html { background: #f8fafc; border: 1px solid #c7d2fe; border-radius: 0.75em; padding: 2em; max-width: 900px; margin: 2em auto; }
        .project-docx-html h1 { font-size: 2.25rem; color: #1e40af; margin-bottom: 0.75em; margin-top: 0.5em; font-weight: bold; }
        .project-docx-html h2 { font-size: 1.5rem; color: #2563eb; margin-bottom: 0.6em; margin-top: 1.2em; font-weight: 600; }
        .project-docx-html h3 { font-size: 1.2rem; color: #2563eb; margin-bottom: 0.5em; margin-top: 1em; font-weight: 500; }
        .project-docx-html p { margin-bottom: 0.7em; color: #1e293b; }
        .project-docx-html table { border-collapse: collapse; width: 100%; margin: 1em 0; background: #fff; }
        .project-docx-html th, .project-docx-html td { border: 1px solid #2563eb; padding: 0.5em 1em; text-align: left; }
        .project-docx-html th { background: #dbeafe; color: #1e40af; font-weight: bold; }
        .project-docx-html tr:nth-child(even) td { background: #f1f5f9; }
        .project-docx-html ul, .project-docx-html ol { margin-left: 2em; margin-bottom: 1em; padding-left: 1.5em; }
        .project-docx-html ul { list-style-type: disc; }
        .project-docx-html ol { list-style-type: decimal; }
        .project-docx-html ul ul, .project-docx-html ol ul { list-style-type: circle; }
        .project-docx-html ol ol, .project-docx-html ul ol { list-style-type: lower-latin; }
        .project-docx-html li { margin-bottom: 0.3em; color: #1e293b; }
        .project-docx-html li > ul, .project-docx-html li > ol { margin-top: 0.2em; margin-bottom: 0.2em; }
        .project-docx-html a { color: #2563eb; text-decoration: underline; word-break: break-all; }
        .project-docx-html img, .project-docx-img { max-width: 100%; height: auto; display: block; margin: 1em auto; box-shadow: 0 2px 8px rgba(30,64,175,0.08); border-radius: 0.5em; }
      </style>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>Project Instruction Preview</title>${style}</head><body><div class="project-docx-html">${processedHtml}</div></body></html>`);
      win.document.close();
    }
  };
  return null;
}
import React, { useState, useEffect } from "react";

// Helper component to show only the first page of docx HTML, with expand/collapse
function DocxPreview({ html }) {
  const [showFull, setShowFull] = useState(false);
  // Split by page break if present (mammoth uses <hr style="page-break-before:always" /> for page breaks)
  // Fix: Move heading after table to before table
  function fixTableHeadings(html) {
    return html.replace(/(<table[\s\S]*?<\/table>)(\s*<(h[1-6])[^>]*>.*?<\/\3>)/gi, '$2$1');
  }
  // Fix: Add image styling
  function addImageStyling(html) {
    return html.replace(/<img /g, '<img class="project-docx-img" ');
  }
  let processedHtml = addImageStyling(fixTableHeadings(html));
  let firstPageHtml = processedHtml;
  let hasMore = false;
  if (processedHtml.includes('page-break-before:always')) {
    const parts = processedHtml.split(/<hr[^>]*page-break-before:always[^>]*>/i);
    firstPageHtml = parts[0];
    hasMore = parts.length > 1;
  }
  return (
    <div className="project-docx-html bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-none" style={{ fontFamily: 'Segoe UI, Arial, sans-serif', maxHeight: showFull ? 500 : 320, overflowY: 'auto', position: 'relative' }}>
      <style>{`
                .project-docx-html img, .project-docx-img {
                  max-width: 100%;
                  height: auto;
                  display: block;
                  margin: 1em auto;
                  box-shadow: 0 2px 8px rgba(30,64,175,0.08);
                  border-radius: 0.5em;
                }
        .project-docx-html h1 {
          font-size: 2.25rem;
          color: #1e40af;
          margin-bottom: 0.75em;
          margin-top: 0.5em;
          font-weight: bold;
        }
        .project-docx-html h2 {
          font-size: 1.5rem;
          color: #2563eb;
          margin-bottom: 0.6em;
          margin-top: 1.2em;
          font-weight: 600;
        }
        .project-docx-html h3 {
          font-size: 1.2rem;
          color: #2563eb;
          margin-bottom: 0.5em;
          margin-top: 1em;
          font-weight: 500;
        }
        .project-docx-html p {
          margin-bottom: 0.7em;
          color: #1e293b;
        }
        .project-docx-html table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          background: #fff;
        }
        .project-docx-html th, .project-docx-html td {
          border: 1px solid #2563eb;
          padding: 0.5em 1em;
          text-align: left;
        }
        .project-docx-html th {
          background: #dbeafe;
          color: #1e40af;
          font-weight: bold;
        }
        .project-docx-html tr:nth-child(even) td {
          background: #f1f5f9;
        }
        .project-docx-html ul, .project-docx-html ol {
          margin-left: 2em;
          margin-bottom: 1em;
          padding-left: 1.5em;
        }
        .project-docx-html ul {
          list-style-type: disc;
        }
        .project-docx-html ol {
          list-style-type: decimal;
        }
        .project-docx-html ul ul,
        .project-docx-html ol ul {
          list-style-type: circle;
        }
        .project-docx-html ol ol,
        .project-docx-html ul ol {
          list-style-type: lower-latin;
        }
        .project-docx-html li {
          margin-bottom: 0.3em;
          color: #1e293b;
        }
        .project-docx-html li > ul,
        .project-docx-html li > ol {
          margin-top: 0.2em;
          margin-bottom: 0.2em;
        }
        .project-docx-html a {
          color: #2563eb;
          text-decoration: underline;
          word-break: break-all;
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: showFull ? processedHtml : firstPageHtml }} />
      {hasMore && !showFull && (
        <div className="absolute bottom-2 left-0 w-full flex justify-center pointer-events-none">
          <div className="h-12 w-full bg-linear-to-t from-blue-50 to-transparent absolute bottom-0 left-0" />
        </div>
      )}
      {hasMore && (
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 text-sm font-semibold block mx-auto"
          style={{ position: 'relative', zIndex: 2 }}
          onClick={() => setShowFull((v) => !v)}
        >
          {showFull ? 'Show Less' : 'Show Full Preview'}
        </button>
      )}
    </div>
  );
}
// For date comparison
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().slice(0, 10);
};

const initialProjects = [
  {
    id: 1,
    name: "MFUND",
    pprtFile: "https://example.com/files/alpha-pprt.pdf",
    instructionFile: "/dummy-docs/Project%20Instructions.docx", // Local dummy docx file for demo
    tasks: [
      { id: 101, name: "Task 1", target: 8, status: "Assigned", due: "2026-02-10", priority: "High" },
      { id: 102, name: "Task 2", target: 6, status: "In Progress", due: "2026-02-15", priority: "Medium" }
    ]
  },
  {
    id: 2,
    name: "Project Beta",
    pprtFile: null,
    instructionFile: null,
    tasks: [
      { id: 201, name: "Task A", target: 5, status: "Completed", due: "2026-01-30", priority: "Low" }
    ]
  },
  {
    id: 3,
    name: "Project Gamma",
    pprtFile: "https://example.com/files/gamma-pprt.pdf",
    instructionFile: null,
    tasks: []
  }
];

const DownloadIconLink = ({ url }) => (
  <a
    href={url}
    download=""
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 group-hover:bg-blue-100 rounded-full p-2 shadow-sm"
    title="Download file"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download w-5 h-5" aria-hidden="true"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>
  </a>
);


const TaskCountIcon = ({ count }) => (
  <span className="ml-3 bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-semibold shadow-sm">
    {count}
  </span>
);

const AgentProjectList = () => {
  const [expanded, setExpanded] = useState(null);
  const [dateFilter, setDateFilter] = useState(getTodayString());
  const [projects, setProjects] = useState(initialProjects);
  const [docxHtml, setDocxHtml] = useState({}); // { [projectId]: html }
  const [loadingDocx, setLoadingDocx] = useState({});
  const [docxError, setDocxError] = useState({});

  // Sort projects by latest assigned task (by due date, descending, using Date for accuracy)
  const sortedProjects = React.useMemo(() => {
    return [...projects].sort((a, b) => {
      const getLatestDue = (tasks) => {
        if (!tasks || tasks.length === 0) return null;
        return tasks.map(t => new Date(t.due)).sort((d1, d2) => d2 - d1)[0];
      };
      const aDue = getLatestDue(a.tasks);
      const bDue = getLatestDue(b.tasks);
      if (!aDue && !bDue) return 0;
      if (!aDue) return 1;
      if (!bDue) return -1;
      return bDue - aDue;
    });
  }, [projects]);

  // Filter tasks for today or selected date
  const filterTasksByDate = (tasks, date) =>
    tasks.filter((task) => task.due === date);

  // Add dummy task for today
  const handleAddDummyTask = (projectId) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === projectId
          ? {
              ...proj,
              tasks: [
                ...proj.tasks,
                {
                  id: Date.now(),
                  name: `Dummy Task ${proj.tasks.length + 1}`,
                  target: 4,
                  status: "Assigned",
                  due: dateFilter,
                  priority: "Medium",
                },
              ],
            }
          : proj
      )
    );
  };

  // Fetch and convert docx to HTML when expanded
  useEffect(() => {
    if (!expanded) return;
    const project = projects.find((p) => p.id === expanded);
    if (!project || !project.instructionFile || docxHtml[expanded]) return;
    setTimeout(() => {
      setLoadingDocx((prev) => ({ ...prev, [expanded]: true }));
      setDocxError((prev) => ({ ...prev, [expanded]: null }));
    }, 0);
    fetch(project.instructionFile)
      .then((res) => res.arrayBuffer())
      .then((arrayBuffer) =>
        mammoth.convertToHtml({ arrayBuffer })
      )
      .then((result) => {
        console.log("[Mammoth HTML Output]", result.value);
        setDocxHtml((prev) => ({ ...prev, [expanded]: result.value }));
        setLoadingDocx((prev) => ({ ...prev, [expanded]: false }));
      })
      .catch(() => {
        setDocxError((prev) => ({ ...prev, [expanded]: "Failed to load or convert docx." }));
        setLoadingDocx((prev) => ({ ...prev, [expanded]: false }));
      });
    // eslint-disable-next-line
  }, [expanded, projects]);

  return (
    <div className="max-w-6xl mx-auto py-10 px-2 sm:px-6">
      <h2 className="text-3xl font-extrabold mb-8 text-blue-800 tracking-tight text-center drop-shadow-sm">Agent Project List</h2>
      <div className="flex flex-col gap-8 items-center">
        {sortedProjects.map((project) => {
          const todaysTasks = filterTasksByDate(project.tasks, dateFilter);
          return (
            <div key={project.id} className="bg-white rounded-2xl shadow-xl border border-blue-100 hover:shadow-blue-200 transition-shadow duration-200 w-full" style={{minHeight: '90px', maxWidth: '1000px'}}>
              <div className="flex items-center justify-between px-8 py-4 cursor-pointer min-h-[90px]" onClick={() => setExpanded(expanded === project.id ? null : project.id)}>
                <div className="flex items-center gap-6">
                  <div className="bg-blue-700 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold shadow-md">
                    {project.name[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-800 mb-1">{project.name}</h3>
                    <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Project</span>
                  </div>
                </div>
                <div className="flex items-center gap-8 ml-auto pr-4">
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-blue-700">PPRT :</span>
                    {project.pprtFile ? (
                      <DownloadIconLink url={project.pprtFile} />
                    ) : (
                      <span className="text-gray-400">No file</span>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold text-blue-700">Project Instruction:</span>
                    {project.instructionFile ? (
                      <>
                        <button
                          className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 group-hover:bg-blue-100 rounded-full p-2 shadow-sm mr-1"
                          onClick={() => {
                            // Use the same processing as DocxPreview
                            function fixTableHeadings(html) {
                              return html.replace(/(<table[\s\S]*?<\/table>)(\s*<(h[1-6])[^>]*>.*?<\/\3>)/gi, '$2$1');
                            }
                            function addImageStyling(html) {
                              return html.replace(/<img /g, '<img class=\\"project-docx-img\\" ');
                            }
                            let processedHtml = addImageStyling(fixTableHeadings(docxHtml[project.id] || ""));
                            const style = `
                              <style>
                                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f6ff; margin: 0; padding: 2em; }
                                .project-docx-html { background: #f8fafc; border: 1px solid #c7d2fe; border-radius: 0.75em; padding: 2em; max-width: 900px; margin: 2em auto; }
                                .project-docx-html h1 { font-size: 2.25rem; color: #1e40af; margin-bottom: 0.75em; margin-top: 0.5em; font-weight: bold; }
                                .project-docx-html h2 { font-size: 1.5rem; color: #2563eb; margin-bottom: 0.6em; margin-top: 1.2em; font-weight: 600; }
                                .project-docx-html h3 { font-size: 1.2rem; color: #2563eb; margin-bottom: 0.5em; margin-top: 1em; font-weight: 500; }
                                .project-docx-html p { margin-bottom: 0.7em; color: #1e293b; }
                                .project-docx-html table { border-collapse: collapse; width: 100%; margin: 1em 0; background: #fff; }
                                .project-docx-html th, .project-docx-html td { border: 1px solid #2563eb; padding: 0.5em 1em; text-align: left; }
                                .project-docx-html th { background: #dbeafe; color: #1e40af; font-weight: bold; }
                                .project-docx-html tr:nth-child(even) td { background: #f1f5f9; }
                                .project-docx-html ul, .project-docx-html ol { margin-left: 2em; margin-bottom: 1em; padding-left: 1.5em; }
                                .project-docx-html ul { list-style-type: disc; }
                                .project-docx-html ol { list-style-type: decimal; }
                                .project-docx-html ul ul, .project-docx-html ol ul { list-style-type: circle; }
                                .project-docx-html ol ol, .project-docx-html ul ol { list-style-type: lower-latin; }
                                .project-docx-html li { margin-bottom: 0.3em; color: #1e293b; }
                                .project-docx-html li > ul, .project-docx-html li > ol { margin-top: 0.2em; margin-bottom: 0.2em; }
                                .project-docx-html a { color: #2563eb; text-decoration: underline; word-break: break-all; }
                                .project-docx-html img, .project-docx-img { max-width: 100%; height: auto; display: block; margin: 1em auto; box-shadow: 0 2px 8px rgba(30,64,175,0.08); border-radius: 0.5em; }
                              </style>
                            `;
                            const win = window.open('', '_blank');
                            if (win) {
                              win.document.write(`<!DOCTYPE html><html><head><title>Project Instruction Preview</title>${style}</head><body><div class=\\"project-docx-html\\">${processedHtml}</div></body></html>`);
                              win.document.close();
                            }
                          }}
                          type="button"
                          disabled={!docxHtml[project.id]}
                          title={!docxHtml[project.id] ? 'Preview not loaded yet' : 'Project Instruction Preview'}
                          aria-label="Project Instruction Preview"
                        >
                          {/* Eye icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye w-5 h-5" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <DownloadIconLink url={project.instructionFile} />
                      </>
                    ) : (
                      <span className="text-gray-400">No file</span>
                    )}
                    <TaskCountIcon count={todaysTasks.length} />
                  </div>
                </div>
                <button className="text-blue-700 hover:text-blue-900 focus:outline-none ml-4">
                  {expanded === project.id ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  )}
                </button>
              </div>
              {expanded === project.id && (
                <div className="mt-6 px-8 pb-8">
                  <>
                    {/* Project Instruction HTML view */}
                    {project.instructionFile && (
                      <ProjectInstructionPreview
                        projectId={project.id}
                        loading={loadingDocx[project.id]}
                        error={docxError[project.id]}
                        html={docxHtml[project.id]}
                        instructionFile={project.instructionFile}
                      />
                    )}
                    <div className="flex items-center gap-4 mb-4">
                      <h4 className="text-blue-700 font-bold text-lg">Assigned Tasks</h4>
                      <input
                        type="date"
                        className="border border-blue-200 rounded px-2 py-1 text-blue-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={dateFilter}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setDateFilter(e.target.value)}
                        style={{ minWidth: 120 }}
                      />
                      <button
                        className="ml-2 px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700 text-sm font-semibold"
                        onClick={e => { e.stopPropagation(); handleAddDummyTask(project.id); }}
                        type="button"
                      >
                        Add Dummy Task
                      </button>
                    </div>
                    {todaysTasks.length === 0 ? (
                      <div className="text-gray-400 text-base">No tasks assigned for this date.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-blue-50 bg-blue-50">
                        <table className="min-w-full text-base">
                          <thead>
                            <tr className="bg-blue-100 text-blue-800">
                              <th className="px-4 py-3 text-left font-semibold">Task Name</th>
                              <th className="px-4 py-3 text-left font-semibold">Target/Hr</th>
                              <th className="px-4 py-3 text-left font-semibold">Status</th>
                              <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                              <th className="px-4 py-3 text-left font-semibold">Priority</th>
                            </tr>
                          </thead>
                          <tbody>
                            {todaysTasks.map((task) => (
                              <tr key={task.id} className="hover:bg-blue-200/40 transition">
                                <td className="px-4 py-3 font-medium text-blue-900 whitespace-nowrap">{task.name}</td>
                                <td className="px-4 py-3">{task.target}</td>
                                <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${task.status === 'Completed' ? 'bg-green-200 text-green-800' : task.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{task.status}</span>
                              </td>
                              <td className="px-4 py-3">{task.due}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${task.priority === 'High' ? 'bg-red-200 text-red-800' : task.priority === 'Medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{task.priority}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentProjectList;
