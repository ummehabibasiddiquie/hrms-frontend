/**
 * Open an uploaded document in the browser instead of downloading it.
 * - PDF, images and text: shown by the browser's own viewer (blob with the right type).
 * - Word, Excel, PowerPoint: shown by the Microsoft Office online viewer (needs a public URL).
 */

const INLINE_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".csv": "text/plain",
};

const OFFICE_EXTENSIONS = [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];

export function fileExtension(nameOrUrl) {
  const clean = String(nameOrUrl || "").split("?")[0].split("#")[0].toLowerCase();
  const match = clean.match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

export function canOpenInBrowser(url, fileName) {
  const ext = fileExtension(fileName) || fileExtension(url);
  return Boolean(INLINE_TYPES[ext] || OFFICE_EXTENSIONS.includes(ext));
}

/** Returns false when the type cannot be shown in the browser (caller can fall back to download). */
export async function openDocumentInBrowser(url, fileName) {
  if (!url) return false;
  const ext = fileExtension(fileName) || fileExtension(url);

  if (OFFICE_EXTENSIONS.includes(ext)) {
    const viewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
    window.open(viewer, "_blank", "noopener");
    return true;
  }

  const type = INLINE_TYPES[ext];
  if (!type) return false;

  // Open the tab first (inside the click) so pop-up blockers allow it, then load the file into it.
  const tab = window.open("", "_blank");
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("open failed");
    const blob = new Blob([await response.arrayBuffer()], { type });
    const blobUrl = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = blobUrl;
    } else {
      window.open(blobUrl, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return true;
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
}
