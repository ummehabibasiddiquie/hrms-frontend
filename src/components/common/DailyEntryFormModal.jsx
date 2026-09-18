/**
 * File Name: DailyEntryFormModal.jsx
 * Author: Naitik Maisuriya
 * Description: A reusable modal component for adding/editing Billable Report
 * assigned hours entries.
 */

import React, { useState, useEffect } from "react";
import { X, Save, Calendar, Clock, ClipboardCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import { saveTempQC } from "../../services/qcService";

const DailyEntryFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  isEditMode = false,
  isSubmitting = false,
  user = null,
  userRole = null,
  roleId = null,
  userId = null,
  date = null,
  logged_in_user_id = null,
  allowAssignedHours = true,
  allowQcScore = false,
}) => {
  const [formData, setFormData] = useState({
    assignHours: "",
    qcScore: ""
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const hoursReadOnly = roleId === 5 || String(userRole || "").toUpperCase().includes("QA");
  const showHours = allowAssignedHours && !hoursReadOnly;
  const showQc = allowQcScore;

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        // Helper function to safely parse numeric values
        const parseNumericValue = (value) => {
          if (value === null || value === undefined || value === "" || value === "-") {
            return "";
          }
          const num = Number(value);
          return isNaN(num) ? "" : value;
        };

        setFormData({
          assignHours: parseNumericValue(
            initialData.assignHours || initialData.assign_hours || initialData.assigned_hours
          ),
          qcScore: parseNumericValue(initialData.qcScore || initialData.qc_score)
        });
      } else {
        // Reset for add mode
        setFormData({
          assignHours: "",
          qcScore: ""
        });
      }
      setErrors({});
      setTouched({});
    }
  }, [isOpen, isEditMode, initialData]);

  // Validation functions
  const validateField = (name, value) => {
    switch (name) {
      case "assignHours":
        if (!showHours) return "";
        if (value && value !== "") {
          const hours = Number(value);
          if (isNaN(hours) || hours < 0) return "Must be a non-negative number";
          if (hours > 24) return "Cannot exceed 24 hours";
        }
        return "";
      case "qcScore":
        if (!showQc) return "";
        if (value === "" || value === null || value === undefined) return "QC score is required";
        {
          const score = Number(value);
          if (isNaN(score) || score < 0 || score > 100) return "Must be between 0 and 100";
        }
        return "";

      default:
        return "";
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const error = validateField(name, value);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    setErrors(newErrors);
    setTouched({
      assignHours: showHours,
      qcScore: showQc
    });

    // If no errors, submit
    if (Object.keys(newErrors).length === 0) {
      try {
        // Convert date to YYYY-MM-DD format
        let formattedDate = date;
        console.log('Original date:', date);
        if (date) {
          // Remove newline characters and day names
          let cleanDate = date.toString().replace(/\n/g, '').trim();
          // Remove day names (Monday, Tuesday, etc.)
          cleanDate = cleanDate.replace(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi, '').trim();
          console.log('Cleaned date:', cleanDate);
          
          // Extract date part if it contains day names like "Friday"
          const dateMatch = cleanDate.match(/(\d{4})[^\d]*(\d{2})[^\d]*(\d{2})/);
          if (dateMatch) {
            formattedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            console.log('Extracted date parts:', dateMatch);
            console.log('Formatted date from regex:', formattedDate);
          } else if (cleanDate.includes('-')) {
            const parts = cleanDate.split('-');
            // Check if it's DD-MM-YYYY format (first part is day <= 31)
            if (parts.length === 3 && parseInt(parts[0]) <= 31 && parseInt(parts[2]) > 31) {
              formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert to YYYY-MM-DD
              console.log('Formatted date from DD-MM-YYYY:', formattedDate);
            }
          }
        }
        console.log('Final formatted date:', formattedDate);

        // Build payload with only fields that have values
        const payload = {
          user_id: userId,
          date: formattedDate,
          logged_in_user_id: logged_in_user_id
        };

        if (showHours && formData.assignHours !== '' && formData.assignHours != null) {
          payload.assigned_hours = Number(formData.assignHours);
        }
        if (showQc && formData.qcScore !== '' && formData.qcScore != null) {
          payload.qc_score = Number(formData.qcScore);
        }

        if (payload.assigned_hours === undefined && payload.qc_score === undefined) {
          toast.error('Enter assigned hours or QC score');
          return;
        }

        const response = await saveTempQC(payload);
        
        if (response.status) {
          toast.success(response.message || 'Saved successfully!');
          onSubmit(formData); // Call parent's onSubmit for additional handling (triggers refresh)
          handleClose(); // Close modal after successful save
        } else {
          toast.error(response.message || 'Failed to save assigned hours');
        }
      } catch (error) {
        console.error('Error saving assigned hours data:', error);
        console.error('Error response:', error.response?.data);
        const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to save assigned hours. Please try again.';
        toast.error(errorMessage);
      }
    }
  };

  const handleClose = () => {
    setFormData({
      assignHours: "",
      qcScore: ""
    });
    setErrors({});
    setTouched({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    // Modal Backdrop
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {isEditMode ? (
                <>
                  <Save className="w-6 h-6" />
                  Edit Daily Entry
                </>
              ) : (
                <>
                  <Calendar className="w-6 h-6" />
                  Add Daily Entry
                </>
              )}
            </h2>
            {user && (
              <p className="text-blue-100 text-sm mt-1">
                {user.user_name || user.name}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body - Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {showHours && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Assign Hours
              </label>
              <input
                type="number"
                name="assignHours"
                value={formData.assignHours}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`block w-full px-4 py-3 text-sm bg-slate-50 border ${
                  touched.assignHours && errors.assignHours
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-blue-500'
                } rounded-xl focus:outline-none focus:ring-2 transition-all duration-200`}
                placeholder="Enter hours (e.g., 8.5)"
                min="0"
                max="24"
                step="0.01"
                disabled={isSubmitting}
              />
              {touched.assignHours && errors.assignHours && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <span className="font-semibold">⚠</span> {errors.assignHours}
                </p>
              )}
            </div>
            )}

            {showQc && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <ClipboardCheck className="w-4 h-4 text-blue-600" />
                QC Score
              </label>
              <input
                type="number"
                name="qcScore"
                value={formData.qcScore}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`block w-full px-4 py-3 text-sm bg-slate-50 border ${
                  touched.qcScore && errors.qcScore
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-blue-500'
                } rounded-xl focus:outline-none focus:ring-2 transition-all duration-200`}
                placeholder="Enter QC score (0–100)"
                min="0"
                max="100"
                step="0.01"
                disabled={isSubmitting}
              />
              {touched.qcScore && errors.qcScore && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <span className="font-semibold">⚠</span> {errors.qcScore}
                </p>
              )}
            </div>
            )}

          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-all duration-200"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center gap-2 ${
              isSubmitting
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-lg hover:shadow-xl'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {isEditMode ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? 'Update Entry' : 'Save Entry'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyEntryFormModal;
