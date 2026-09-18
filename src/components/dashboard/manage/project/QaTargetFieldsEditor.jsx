import React from "react";
import { Plus, Trash2 } from "lucide-react";

/**
 * Three QC hour criteria (set only one style per task):
 * 1) Minutes per QC record
 * 2) Minutes per file
 * 3) Object-count ranges (agent file column sum → minutes for that band)
 */
const QaTargetFieldsEditor = ({
  formData,
  setFormData,
  excelColumnHeaders = [],
  disabled = false,
}) => {
  const update = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

  const updateRange = (idx, field, value) => {
    setFormData((prev) => {
      const next = [...(prev.qaTargetRanges || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, qaTargetRanges: next };
    });
  };

  const addRange = () => {
    setFormData((prev) => ({
      ...prev,
      qaTargetRanges: [
        ...(prev.qaTargetRanges || []),
        { min: "", max: "", minutes: "" },
      ],
    }));
  };

  const removeRange = (idx) => {
    setFormData((prev) => ({
      ...prev,
      qaTargetRanges: (prev.qaTargetRanges || []).filter((_, i) => i !== idx),
    }));
  };

  const columnOptions = Array.from(
    new Set(
      [
        ...(excelColumnHeaders || []).map(String),
        formData.qaCountColumn ? String(formData.qaCountColumn) : "",
      ].filter(Boolean)
    )
  );

  return (
    <div className="md:col-span-2 border border-slate-200 rounded-lg p-3 bg-white space-y-3">
      <div>
        <h4 className="text-xs font-bold text-slate-700 text-left">QA hour criteria</h4>
        <p className="text-[11px] text-slate-500 text-left mt-0.5">
          Use one mode per task. Object ranges use the agent file column sum (all image rows).
          Record / file minutes use QC data. Leave blank if this task has no QC hour target.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">
            1. Minutes per QC record
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 2"
            value={formData.qaMinutesPerRecord || ""}
            onChange={(e) => update({ qaMinutesPerRecord: e.target.value })}
            disabled={disabled}
          />
          <p className="text-[10px] text-slate-400 mt-1 text-left">
            Hours = QC sample records × minutes ÷ 60
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">
            2. Minutes per file
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 10"
            value={formData.qaMinutesPerFile || ""}
            onChange={(e) => update({ qaMinutesPerFile: e.target.value })}
            disabled={disabled}
          />
          <p className="text-[10px] text-slate-400 mt-1 text-left">
            Hours = minutes ÷ 60 (one file)
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-3">
        <p className="text-xs font-semibold text-slate-600 text-left">
          3. Object count ranges (agent file)
        </p>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 text-left">
            Count column (sum all rows)
          </label>
          {columnOptions.length > 0 ? (
            <select
              className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={formData.qaCountColumn || ""}
              onChange={(e) => update({ qaCountColumn: e.target.value })}
              disabled={disabled}
            >
              <option value="">— None —</option>
              {columnOptions.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              placeholder='e.g. New add object'
              value={formData.qaCountColumn || ""}
              onChange={(e) => update({ qaCountColumn: e.target.value })}
              disabled={disabled}
            />
          )}
          <p className="text-[10px] text-slate-400 mt-1 text-left">
            e.g. 3 images → sum that column across 3 rows, then pick the matching range minutes
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-500 text-left">
              Object min–max → minutes
            </label>
            <button
              type="button"
              onClick={addRange}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add range
            </button>
          </div>
          {(formData.qaTargetRanges || []).length === 0 ? (
            <p className="text-[11px] text-slate-400 text-left">No object ranges configured.</p>
          ) : (
            <div className="space-y-2">
              {(formData.qaTargetRanges || []).map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="number"
                    className="col-span-3 text-sm p-2 border border-slate-200 rounded-lg"
                    placeholder="Min objs"
                    value={row.min}
                    onChange={(e) => updateRange(idx, "min", e.target.value)}
                    disabled={disabled}
                  />
                  <input
                    type="number"
                    className="col-span-3 text-sm p-2 border border-slate-200 rounded-lg"
                    placeholder="Max objs"
                    value={row.max}
                    onChange={(e) => updateRange(idx, "max", e.target.value)}
                    disabled={disabled}
                  />
                  <input
                    type="number"
                    className="col-span-4 text-sm p-2 border border-slate-200 rounded-lg"
                    placeholder="Minutes"
                    value={row.minutes ?? row.target ?? ""}
                    onChange={(e) => updateRange(idx, "minutes", e.target.value)}
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={() => removeRange(idx)}
                    disabled={disabled}
                    className="col-span-2 inline-flex justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    title="Remove range"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QaTargetFieldsEditor;
