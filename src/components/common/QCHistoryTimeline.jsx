/**
 * File: QCHistoryTimeline.jsx
 * Description: Table view for QC workflow history with error popup
 */
import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Clock,
  X,
  AlertTriangle
} from 'lucide-react';
import { formatISTDateMedium } from '../../utils/dateTimeIST';

const QCHistoryTimeline = ({ qcRecord, correctionHistory = [], reworkHistory = [], showLateSubmission = false }) => {
  const [errorModal, setErrorModal] = useState({ open: false, errors: [], title: '' });

  // Build timeline events
  const buildTimeline = () => {
    const events = [];

    // Initial QC
    events.push({
      id: `qc-${qcRecord.id}`,
      type: 'Initial QC',
      date: qcRecord.date_of_file_submission || qcRecord.created_at,
      status: qcRecord.status,
      score: qcRecord.qc_score,
      errors: qcRecord.error_list || [],
      filePath: qcRecord.qc_file_path,
      isLate: qcRecord.is_late_submission || false,
      lateByHours: qcRecord.late_by_hours || null
    });

    // Corrections
    correctionHistory.forEach((c) => {
      events.push({
        id: `correction-${c.id || c.qc_correction_id}`,
        type: `Correction #${c.attempt_count || c.correction_count || 1}`,
        date: c.submitted_at || c.created_at,
        status: c.review_status || c.correction_status,
        score: c.qc_score,
        errors: c.new_errors || c.correction_error_list || [],
        filePath: c.file_path || c.correction_file_path,
        isLate: c.is_late_submission || false,
        lateByHours: c.late_by_hours || null
      });
    });

    // Reworks
    reworkHistory.forEach((r) => {
      events.push({
        id: `rework-${r.id || r.qc_rework_id}`,
        type: `Rework #${r.attempt_count || r.rework_count || 1}`,
        date: r.submitted_at || r.created_at,
        status: r.review_status || r.rework_status,
        score: r.qc_score || r.rework_qc_score,
        errors: r.new_errors || r.rework_error_list || [],
        filePath: r.file_path || r.rework_file_path,
        isLate: r.is_late_submission || false,
        lateByHours: r.late_by_hours || null
      });
    });

    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const timeline = buildTimeline();

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return formatISTDateMedium(dateString);
  };

  const getStatusBadge = (status, score) => {
    if (status === 'regular' || status === 'completed' || score === 100) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" /> Passed
        </span>
      );
    }
    if (status === 'under_review') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
          <Clock className="w-3 h-3" /> Under Review
        </span>
      );
    }
    if (status === 'correction') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3 h-3" /> Correction
        </span>
      );
    }
    if (status === 'rework' || status === 'reviewed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" /> Rework
        </span>
      );
    }
    return <span className="text-xs text-slate-500">—</span>;
  };

  const getScoreClass = (score) => {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score === 100) return 'text-green-600 font-bold';
    if (score >= 95) return 'text-yellow-600 font-bold';
    return 'text-red-600 font-bold';
  };

  const parseErrors = (errors) => {
    if (!errors) return [];
    if (typeof errors === 'string') {
      try { return JSON.parse(errors); } catch { return []; }
    }
    return Array.isArray(errors) ? errors : [];
  };

  const openErrorModal = (errors, type) => {
    setErrorModal({ open: true, errors: parseErrors(errors), title: `${type} - Errors` });
  };

  const closeErrorModal = () => {
    setErrorModal({ open: false, errors: [], title: '' });
  };

  if (timeline.length === 0) {
    return <div className="text-center py-4 text-slate-500 text-sm">No history available</div>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
              {showLateSubmission && <th className="px-3 py-2 text-center font-semibold">Submission</th>}
              <th className="px-3 py-2 text-center font-semibold">Score</th>
              <th className="px-3 py-2 text-center font-semibold">Errors</th>
              <th className="px-3 py-2 text-center font-semibold">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {timeline.map((event) => {
              const errors = parseErrors(event.errors);

              return (
                <tr key={event.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{event.type}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(event.date)}</td>
                  <td className="px-3 py-2 text-center">{getStatusBadge(event.status, event.score)}</td>
                  {showLateSubmission && (
                    <td className="px-3 py-2 text-center">
                      {event.isLate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                          <AlertTriangle className="w-3 h-3" />
                          Late
                          {event.lateByHours && <span className="text-orange-500">({event.lateByHours}h)</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
                          <Clock className="w-3 h-3" />
                          On Time
                        </span>
                      )}
                    </td>
                  )}
                  <td className={`px-3 py-2 text-center ${getScoreClass(event.score)}`}>
                    {event.score !== null && event.score !== undefined ? `${event.score}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {errors.length > 0 ? (
                      <button
                        onClick={() => openErrorModal(event.errors, event.type)}
                        className="relative inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors shadow-sm"
                      >
                        View Errors
                        <span className="absolute -top-2 -right-2 min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full bg-rose-700 text-white text-xs font-bold shadow">
                          {errors.length}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-600 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> None
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {event.filePath ? (
                      <a
                        href={event.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                      >
                        <Download className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Error Modal */}
      {errorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeErrorModal}
          ></div>

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{errorModal.title}</h3>
                  <p className="text-blue-100 text-sm">{errorModal.errors.length} error{errorModal.errors.length !== 1 ? 's' : ''} found</p>
                </div>
              </div>
              <button
                onClick={closeErrorModal}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {errorModal.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full bg-rose-400 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-rose-400 text-white text-xs font-semibold rounded">
                          Row {err.row}
                        </span>
                        {err.points && (
                          <span className="px-2 py-0.5 bg-slate-500 text-white text-xs font-semibold rounded">
                            -{err.points} pts
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-rose-700 font-medium">
                        {err.error || `${err.category}${err.subcategory ? ` - ${err.subcategory}` : ''}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={closeErrorModal}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QCHistoryTimeline;
