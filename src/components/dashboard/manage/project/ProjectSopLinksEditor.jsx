import React, { useState } from "react";
import { ExternalLink, Link2, Plus, XCircle } from "lucide-react";

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

/**
 * Shared-drive SOP links for a project (title + URL).
 * The HRMS only opens the link; view/edit rights are set on the drive itself.
 */
const ProjectSopLinksEditor = ({ value = [], onChange, disabled = false }) => {
  const links = Array.isArray(value) ? value : [];
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const addLink = () => {
    const cleanUrl = url.trim();
    const cleanTitle = title.trim();
    if (!isHttpUrl(cleanUrl)) {
      setError("Paste the full link, starting with https://");
      return;
    }
    if (links.some((link) => link.url === cleanUrl)) {
      setError("This link is already added");
      return;
    }
    onChange([...links, { title: cleanTitle || cleanUrl, url: cleanUrl }]);
    setTitle("");
    setUrl("");
    setError("");
  };

  const removeLink = (index) => {
    onChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="md:col-span-3">
      <label className="block text-sm font-semibold text-gray-700 mb-1">SOP Links (shared drive)</label>
      <p className="text-xs text-gray-500 mb-2">
        Share the file on the drive as Viewer, then paste its link. People can open it from the HRMS but cannot change it here.
      </p>
      <div className="flex flex-col md:flex-row gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title, e.g. Project SOP v2"
          disabled={disabled}
          className="md:w-1/3 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLink();
            }
          }}
          placeholder="https://drive.google.com/..."
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addLink}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add link
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}

      {links.length > 0 && (
        <div className="mt-2 space-y-1">
          {links.map((link, index) => (
            <div
              key={`${link.url}-${index}`}
              className="flex items-center justify-between gap-2 px-3 py-1.5 border border-gray-200 rounded-md bg-white"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 min-w-0 text-xs text-blue-600 hover:underline"
                title={link.url}
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{link.title || link.url}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                  title="Remove link"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectSopLinksEditor;
