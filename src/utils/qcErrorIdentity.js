/**
 * Identify QC errors by QC Code (Excel column), not sample serial / row number.
 */

export function cellDisplayValue(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "object") return String(value).trim();
  if (value.text != null) return String(value.text).trim();
  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text || "").join("").trim();
  }
  if (value.result != null) return String(value.result).trim();
  if (value.hyperlink) return String(value.hyperlink).trim();
  return "";
}

export function normalizeHeader(name) {
  return String(name || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isQcCodeHeader(name) {
  const n = normalizeHeader(name);
  if (!n) return false;
  if (n === "qc code" || n === "qccode") return true;
  return n.includes("qc") && n.includes("code");
}

export function extractQcCode(record) {
  if (!record || typeof record !== "object") return "";
  const match = Object.entries(record).find(([key]) => isQcCodeHeader(key));
  return match ? cellDisplayValue(match[1]) : "";
}

export function getQcFormDisplayKeys(record, maxCols = 3) {
  if (!record || typeof record !== "object") return [];
  const keys = Object.keys(record).filter((key) => key !== "id");
  const qcKey = keys.find(isQcCodeHeader);
  const rest = keys.filter((key) => key !== qcKey);
  return (qcKey ? [qcKey, ...rest] : rest).slice(0, maxCols);
}

export function getErrorIdentity(err) {
  if (!err || typeof err !== "object") return "";
  const code = cellDisplayValue(err.qc_code || err.qcCode || err.QC_Code);
  if (code) return `QC Code ${code}`;
  if (err.row != null && err.row !== "") return `Row ${err.row}`;
  return "";
}
