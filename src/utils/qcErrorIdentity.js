/**
 * Identify QC errors by QC Code (Excel column), not sample serial / row number.
 */
import * as XLSX from "xlsx";

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
  const compact = n.replace(/[^a-z0-9]/g, "");
  if (n === "qc code" || n === "qccode" || compact === "qccode") return true;
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
  const code =
    cellDisplayValue(err.qc_code || err.qcCode || err.QC_Code) ||
    extractQcCode(err.originalData || err.original_data || err.record);
  if (code) return `QC Code ${code}`;
  if (err.row != null && err.row !== "") return `Row ${err.row}`;
  return "";
}

export function errorsNeedQcCode(errors) {
  return (errors || []).some(
    (err) => err && typeof err === "object" && !cellDisplayValue(err.qc_code || err.qcCode || err.QC_Code)
  );
}

function sanitizeFileUrl(raw) {
  const fileUrl = String(raw || "").trim();
  const httpsAt = fileUrl.indexOf("https://", 1);
  if (httpsAt > 0) return fileUrl.slice(httpsAt);
  const httpAt = fileUrl.indexOf("http://", 1);
  if (httpAt > 0) return fileUrl.slice(httpAt);
  return fileUrl;
}

/** Fill qc_code from a sheet (array-of-arrays, row 1 = headers). Mutates and returns errors. */
export function attachQcCodesFromAoA(errors, aoa) {
  const list = errors || [];
  if (!Array.isArray(aoa) || aoa.length < 2) return list;
  const headers = (aoa[0] || []).map((h) => cellDisplayValue(h));
  const qcIdx = headers.findIndex((h) => isQcCodeHeader(h));
  if (qcIdx < 0) return list;

  const codesByExcelRow = new Map();
  const orderedCodes = [];
  for (let r = 1; r < aoa.length; r++) {
    const first = cellDisplayValue(aoa[r]?.[0]).toLowerCase();
    if (first === "error list") break;
    const code = cellDisplayValue(aoa[r]?.[qcIdx]);
    if (!code) continue;
    const excelRow = r + 1;
    codesByExcelRow.set(excelRow, code);
    orderedCodes.push(code);
  }
  if (!orderedCodes.length) return list;

  const onlyCode = orderedCodes.length === 1 ? orderedCodes[0] : "";
  list.forEach((err) => {
    if (!err || typeof err !== "object") return;
    if (cellDisplayValue(err.qc_code || err.qcCode || err.QC_Code)) return;
    if (onlyCode) {
      err.qc_code = onlyCode;
      return;
    }
    const rowNum = Number(err.row);
    if (!Number.isFinite(rowNum)) return;
    const mapped =
      codesByExcelRow.get(rowNum) ||
      codesByExcelRow.get(rowNum + 1) ||
      codesByExcelRow.get(rowNum - 1) ||
      (rowNum >= 1 && rowNum <= orderedCodes.length ? orderedCodes[rowNum - 1] : "");
    if (mapped) err.qc_code = mapped;
  });
  return list;
}

/** Download sample/tracker Excel and attach QC Code onto errors that only have a row. */
export async function enrichErrorListFromFile(errors, fileUrls) {
  const list = (Array.isArray(errors) ? errors : []).map((err) =>
    err && typeof err === "object" ? { ...err } : err
  );
  if (!errorsNeedQcCode(list)) return list;
  const urls = (Array.isArray(fileUrls) ? fileUrls : [fileUrls])
    .map(sanitizeFileUrl)
    .filter((url) => /^https?:\/\//i.test(url));

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) continue;
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      attachQcCodesFromAoA(list, aoa);
      if (!errorsNeedQcCode(list)) break;
    } catch {
      /* try next url */
    }
  }
  return list;
}
