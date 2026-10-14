/**
 * Shared empty QA target fields for task forms.
 */
export const emptyQaTargetFields = () => ({
  qaCountColumn: "",
  qaTargetRanges: [],
  qaMinutesPerFile: "",
  qaMinutesPerRecord: "",
});

export const parseQaTargetFieldsFromTask = (task) => {
  let ranges = [];
  const raw = task?.qa_target_ranges;
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        ranges = parsed.map((r) => ({
          min: r?.min != null ? String(r.min) : "",
          max: r?.max != null ? String(r.max) : "",
          // minutes preferred; legacy `target` treated as minutes
          minutes:
            r?.minutes != null
              ? String(r.minutes)
              : r?.target != null
                ? String(r.target)
                : "",
        }));
      }
    } catch {
      ranges = [];
    }
  }
  return {
    qaCountColumn: task?.qa_count_column || "",
    qaTargetRanges: ranges,
    qaMinutesPerFile:
      task?.qa_minutes_per_file != null && task?.qa_minutes_per_file !== ""
        ? String(task.qa_minutes_per_file)
        : "",
    qaMinutesPerRecord:
      task?.qa_minutes_per_record != null && task?.qa_minutes_per_record !== ""
        ? String(task.qa_minutes_per_record)
        : "",
  };
};

const filledText = (value) => String(value ?? "").trim() !== "";

/** Range mode counts as started once a column is chosen or a band row exists. */
export const qaTargetRangeIsStarted = (formData) => {
  if (filledText(formData?.qaCountColumn)) return true;
  return (formData?.qaTargetRanges || []).length > 0;
};

const rangeBandIsValid = (row) => {
  const min = Number(row?.min);
  const max = Number(row?.max);
  const minutes = Number(row?.minutes != null ? row.minutes : row?.target);
  return Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(minutes) && minutes > 0;
};

/** True when a saved band would actually be used for QC hours. */
export const qaTargetHasValidRanges = (formData) =>
  (formData?.qaTargetRanges || []).some(rangeBandIsValid);

/**
 * One QC target type per task.
 * If older data has more than one, keep the type hours already use:
 * valid object ranges, then minutes per file, then minutes per record.
 * A column or an unfinished band still counts as range once the minute fields are empty.
 */
export const activeQaTargetMode = (formData) => {
  if (qaTargetHasValidRanges(formData)) return "range";
  if (filledText(formData?.qaMinutesPerFile)) return "file";
  if (filledText(formData?.qaMinutesPerRecord)) return "record";
  if (qaTargetRangeIsStarted(formData)) return "range";
  return "";
};

export const applyExclusiveQaTarget = (formData) => {
  const mode = activeQaTargetMode(formData);
  const file = filledText(formData?.qaMinutesPerFile);
  const record = filledText(formData?.qaMinutesPerRecord);
  const range = qaTargetRangeIsStarted(formData);
  if (mode === "range") {
    if (!file && !record) return formData;
    return { ...formData, qaMinutesPerFile: "", qaMinutesPerRecord: "" };
  }
  if (mode === "file") {
    if (!record && !range) return formData;
    return {
      ...formData,
      qaMinutesPerRecord: "",
      qaCountColumn: "",
      qaTargetRanges: [],
    };
  }
  if (mode === "record") {
    if (!file && !range) return formData;
    return {
      ...formData,
      qaMinutesPerFile: "",
      qaCountColumn: "",
      qaTargetRanges: [],
    };
  }
  return formData;
};

export const serializeQaTargetPayload = (formData) => {
  const exclusive = applyExclusiveQaTarget(formData);
  const ranges = (exclusive.qaTargetRanges || [])
    .map((r) => ({
      min: Number(r.min),
      max: Number(r.max),
      minutes: Number(r.minutes != null ? r.minutes : r.target),
    }))
    .filter(
      (r) =>
        Number.isFinite(r.min) &&
        Number.isFinite(r.max) &&
        Number.isFinite(r.minutes) &&
        r.minutes > 0
    );
  const fileMin = String(exclusive.qaMinutesPerFile || "").trim();
  const recMin = String(exclusive.qaMinutesPerRecord || "").trim();
  return {
    qaCountColumn: (exclusive.qaCountColumn || "").trim(),
    qaTargetRanges: ranges,
    qaMinutesPerFile: fileMin === "" ? "" : fileMin,
    qaMinutesPerRecord: recMin === "" ? "" : recMin,
  };
};

/**
 * Short label for Projects & Targets task list.
 * Prefer object ranges → file minutes → record minutes.
 * No QA criteria configured → blank (do not fall back to agent Target / Hr).
 */
export const formatQaTargetSummary = (task) => {
  const fields = parseQaTargetFieldsFromTask(task);
  const ranges = (fields.qaTargetRanges || [])
    .map((r) => ({
      min: Number(r.min),
      max: Number(r.max),
      minutes: Number(r.minutes),
    }))
    .filter(
      (r) =>
        Number.isFinite(r.min) &&
        Number.isFinite(r.max) &&
        Number.isFinite(r.minutes) &&
        r.minutes > 0
    );

  if (ranges.length > 0) {
    const col = fields.qaCountColumn ? ` · ${fields.qaCountColumn}` : "";
    const bands = ranges
      .map((r) => `${r.min}–${r.max}: ${r.minutes}m`)
      .join(", ");
    return {
      mode: "object_range",
      label: `Ranges${col}`,
      detail: bands,
    };
  }

  const fileMin = Number(fields.qaMinutesPerFile);
  if (Number.isFinite(fileMin) && fileMin > 0) {
    return {
      mode: "file_minutes",
      label: `${fileMin} min / file`,
      detail: "",
    };
  }

  const recMin = Number(fields.qaMinutesPerRecord);
  if (Number.isFinite(recMin) && recMin > 0) {
    return {
      mode: "record_minutes",
      label: `${recMin} min / record`,
      detail: "",
    };
  }

  return { mode: "none", label: "", detail: "" };
};
