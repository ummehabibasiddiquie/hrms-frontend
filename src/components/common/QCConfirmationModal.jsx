/**
 * File: QCConfirmationModal.jsx
 * Author: Naitik Maisuriya
 * Description: Confirmation modal for QC form submission
 */
import React, { useState } from 'react';
import { X, User, Mail, FolderOpen, Briefcase, Award, XCircle, ListChecks, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';

/**
 * QCConfirmationModal Component
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Function to close modal
 * @param {function} onConfirm - Function to confirm submission
 * @param {object} data - Data to display in modal
 * @param {string} submissionType - Type of submission: 'regular', 'rework', 'correction'
 * @param {boolean} loading - Whether submission is in progress
 */
const QCConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  data = {}, 
  submissionType = 'regular',
  loading = false 
}) => {
  const [comments, setComments] = useState('');
  
  if (!isOpen) return null;

  const {
    qaName = 'N/A',
    agentEmail = 'N/A',
    projectName = 'N/A',
    taskName = 'N/A',
    status = 'Regular',
    qcScore = 0,
    errorCount = 0,
    errorList = []
  } = data;

  const handleSubmit = () => {
    onConfirm(comments);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-40 backdrop-blur-sm" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Confirm QC Submission</h2>
              <p className="text-blue-100 text-sm">Please review the details before submission</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* QA Information Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Quality Assurance Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* QA Name */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                <p className="text-xs text-slate-600 font-medium mb-1">QA Agent Name</p>
                <p className="text-base font-bold text-slate-800">{qaName}</p>
              </div>

              {/* Agent Email */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-slate-600 font-medium">Agent Email</p>
                </div>
                <p className="text-sm font-semibold text-blue-700 break-all">{agentEmail}</p>
              </div>
            </div>
          </div>

          {/* Project Details Section */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-5 border-2 border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-600" />
              Project Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Name */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Project Name</p>
                <p className="text-base font-bold text-slate-800">{projectName}</p>
              </div>

              {/* Task Name */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <p className="text-xs text-slate-600 font-medium">Task Name</p>
                </div>
                <p className="text-base font-bold text-slate-800">{taskName}</p>
              </div>

              {/* Status */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Status</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                  status === 'Regular' ? 'bg-green-100 text-green-700 border border-green-300' : 
                  status === 'Rework' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' : 
                  'bg-red-100 text-red-700 border border-red-300'
                }`}>
                  {status === 'Regular' ? <CheckCircle2 className="w-4 h-4" /> : 
                   status === 'Rework' ? <AlertCircle className="w-4 h-4" /> : 
                   <XCircle className="w-4 h-4" />}
                  {status}
                </span>
              </div>

              {/* QC Score */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-slate-600 font-medium">Final QC Score</p>
                </div>
                <p className={`text-2xl font-bold ${
                  qcScore >= 95 ? 'text-green-600' : qcScore >= 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {qcScore.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Error Details Section */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-5 border-2 border-red-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Error Summary
              </h3>
              
              {/* Error Count */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-red-200 mb-4">
                <p className="text-xs text-slate-600 font-medium mb-1">Total Errors Marked</p>
                <p className="text-3xl font-bold text-red-600">{errorCount}</p>
              </div>

              {/* Error List */}
              {errorList.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm border border-red-200">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-red-600" />
                    Error Breakdown
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {errorList.map((error, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                        <span className="text-sm font-medium text-slate-700">{error.name}</span>
                        <span className="px-3 py-1 bg-red-200 text-red-800 text-xs font-bold rounded-full">
                          {error.count} {error.count === 1 ? 'error' : 'errors'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          {/* Comments Section */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border-2 border-purple-200">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              Comments <span className="text-red-600">*</span>
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Please provide detailed comments about the QC evaluation. Refer to QC Code (not Excel row numbers) so the agent can find the image.
            </p>
            <div className="bg-white rounded-lg border-2 border-purple-200 overflow-hidden">
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Example: QC Code 6417 — Formatting - Junk Character"
                rows={10}
                className="w-full p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
              />
              <div className="px-4 py-2 bg-slate-50 border-t border-purple-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {comments.length} characters
                </span>
                {!comments.trim() && (
                  <span className="text-xs text-red-600 font-semibold">
                    * Comments are required
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-6 rounded-b-2xl border-t-2 border-slate-200 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all shadow-md border-2 border-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !comments.trim()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Confirm & Submit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QCConfirmationModal;
