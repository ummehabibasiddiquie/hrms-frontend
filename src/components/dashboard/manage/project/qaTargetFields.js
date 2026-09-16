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

export const serializeQaTargetPayload = (formData) => {
  const ranges = (formData.qaTargetRanges || [])
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
  const fileMin = String(formData.qaMinutesPerFile || "").trim();
  const recMin = String(formData.qaMinutesPerRecord || "").trim();
  return {
    qaCountColumn: (formData.qaCountColumn || "").trim(),
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
